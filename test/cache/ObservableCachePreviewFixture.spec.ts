import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { Person } from '../domain/Person';
import * as Assert from 'assert';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ChangeReason } from '../../src/cache/ChangeReason';
import { count, first, from, toArray } from 'ix/iterable';
import { map, orderBy } from 'ix/iterable/operators';

describe('ObservableCachePreviewFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(_source.connect());
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('NoChangesAllowedDuringPreview', () => {
        // On preview, try adding an arbitrary item
        const d = _source.preview().subscribe(_ => {
            expect(() => _source.addOrUpdate(new Person('A', 1))).toThrow();
        });

        // Trigger a change
        _source.addOrUpdate(new Person('B', 2));

        // Cleanup
        d.unsubscribe();
    });

    it('RecursiveEditsWork', () => {
        const person = new Person('A', 1);

        _source.edit(l => {
            _source.addOrUpdate(person);
            expect(toArray(_source.values())).toMatchObject([person]);
            expect(toArray(l.values())).toMatchObject([person]);
        });

        expect(toArray(_source.values())).toMatchObject([person]);
    });

    it('RecursiveEditsHavePostponedEvents', () => {
        const person = new Person('A', 1);

        const preview = asAggregator(_source.preview());
        const connect = asAggregator(_source.connect());
        _source.edit(l => {
            _source.edit(l2 => l2.addOrUpdate(person));
            expect(preview.messages.length).toBe(0);
            expect(connect.messages.length).toBe(0);
        });

        expect(preview.messages.length).toBe(1);
        expect(connect.messages.length).toBe(1);

        expect(toArray(_source.values())).toMatchObject([person]);
    });

    it('PreviewEventsAreCorrect', () => {
        const person = new Person('A', 1);

        const preview = asAggregator(_source.preview());
        const connect = asAggregator(_source.connect());
        _source.edit(l => {
            _source.edit(l2 => l2.addOrUpdate(person));
            l.remove(person);
            l.addOrUpdateValues([new Person('B', 2), new Person('C', 3)]);
        });

        expect(preview.messages).toMatchObject(connect.messages);
        expect(toArray(from(_source.entries())
            .pipe(
                orderBy(([key, value]) => value.age),
                map(([key, value]) => value.age)
            )))
            .toMatchObject([2, 3]);
    });

    it('ChangesAreNotYetAppliedDuringPreview', () => {
        _source.clear();

        // On preview, make sure the list is empty
        const d = _source.preview().subscribe(_ => {
            expect(_source.size).toBe(0);
            expect(count(_source.values())).toBe(0);
        });

        // Trigger a change
        _source.addOrUpdate(new Person('A', 1));

        // Cleanup
        d.unsubscribe();
    });

    it('ConnectPreviewPredicateIsApplied', () => {
        _source.clear();

        // Collect preview messages about even numbers only
        const aggregator = asAggregator( _source.preview(i => i.age === 2));

        // Trigger changes
        _source.addOrUpdate(new Person('A', 1));
        _source.addOrUpdate(new Person('B', 2));
        _source.addOrUpdate(new Person('C', 3));

        expect(aggregator.messages.length).toBe(1);
        expect(aggregator.messages[0].size).toBe(1);
        expect(first(aggregator.messages[0])!.key).toBe('B');
        expect(first(aggregator.messages[0])!.reason).toBe('add');

        // Cleanup
        aggregator.dispose();
    });
});