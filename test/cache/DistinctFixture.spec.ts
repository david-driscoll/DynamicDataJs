import { ISourceCache } from '../../src/cache/ISourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { distinctValues } from '../../src/cache/operators/distinctValues';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { first, from, toArray } from 'ix/iterable';
import { skip } from 'ix/iterable/operators';
import { merge } from 'rxjs';
import { Person } from '../domain/Person';

describe('DistinctFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<number, number>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(_source.connect().pipe(distinctValues(x => x.age)));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('FiresAddWhenaNewItemIsAdded', () => {
        _source.addOrUpdate(new Person('Person1', 20));

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
        expect(first(_results.data.values())).toBe(20);
    });

    it('FiresBatchResultOnce', () => {
        _source.edit(updater => {
            updater.addOrUpdate(new Person('Person1', 20));
            updater.addOrUpdate(new Person('Person2', 21));
            updater.addOrUpdate(new Person('Person3', 22));
        });

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(3);

        expect(toArray(_results.data.values())).toMatchObject([20, 21, 22]);
        expect(first(_results.data.values())).toBe(20);
    });

    it('DuplicatedResultsResultInNoAdditionalMessage', () => {
        _source.edit(updater => {
            updater.addOrUpdate(new Person('Person1', 20));
            updater.addOrUpdate(new Person('Person1', 20));
            updater.addOrUpdate(new Person('Person1', 20));
        });

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
        expect(first(_results.data.values())).toBe(20);
    });

    it('RemovingAnItemRemovesTheDistinct', () => {
        _source.addOrUpdate(new Person('Person1', 20));
        _source.remove(new Person('Person1', 20));
        expect(_results.messages.length).toBe(2);
        expect(_results.data.size).toBe(0);

        expect(first(_results.messages)!.adds).toBe(1);
        expect(first(from(_results.messages).pipe(skip(1)))!.removes).toBe(1);
    });

    it('BreakWithLoadsOfUpdates', () => {
        _source.edit(updater => {
            updater.addOrUpdate(new Person('Person2', 12));
            updater.addOrUpdate(new Person('Person1', 1));
            updater.addOrUpdate(new Person('Person1', 1));
            updater.addOrUpdate(new Person('Person2', 12));

            updater.addOrUpdate(new Person('Person3', 13));
            updater.addOrUpdate(new Person('Person4', 14));
        });

        expect(toArray(_results.data.values())).toMatchObject([12, 1, 13, 14]);

        //This previously threw
        _source.remove(new Person('Person3', 13));

        expect(toArray(_results.data.values())).toMatchObject([12, 1, 14]);
    });

    it('DuplicateKeysRefreshAfterRemove', () => {
        const source1 = updateable(new SourceCache<Person, string>(p => p.name));
        const source2 = updateable(new SourceCache<Person, string>(p => p.name));

        const person = new Person('Person2', 12);

        const results = asAggregator(merge(source1.connect(), source2.connect()).pipe(distinctValues(z => z.age)));

        source1.addOrUpdate(person);
        source2.addOrUpdate(person);
        source2.remove(person);
        source1.refresh(person); // would previously throw KeyNotFoundException here

        expect(results.messages.length).toBe(1);
        expect(toArray(results.data.values())).toMatchObject([12]);

        source1.remove(person);

        expect(results.messages.length).toBe(2);
        expect(toArray(results.data.values()).length).toBe(0);
    });
});
