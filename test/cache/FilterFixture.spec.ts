import { ISourceCache } from '../../src/cache/ISourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { toArray, from, first, range } from 'ix/iterable';
import { map, filter as ixFilter, orderBy } from 'ix/iterable/operators';
import { merge } from 'rxjs';
import { filter } from '../../src/cache/operators/filter';
import { Person } from '../domain/Person';



describe('FilterFixture', () => {

    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(_source.connect(p => p.age > 20));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('AddMatched', () => {
        const person = new Person('Adult1', 50);
        _source.addOrUpdate(person);

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
        expect(first(_results.data.values())).toBe(person);
    });
    it('AddNotMatched', () => {
        const person = new Person('Adult1', 10);
        _source.addOrUpdate(person);

        expect(_results.messages.length).toBe(0);
        expect(_results.data.size).toBe(0);
    });
    it('AddNotMatchedAndUpdateMatched', () => {
        const key = 'Adult1';
        const notmatched = new Person(key, 19);
        const matched = new Person(key, 21);

        _source.edit(updater => {
            updater.addOrUpdate(notmatched);
            updater.addOrUpdate(matched);
        });

        expect(_results.messages.length).toBe(1);
        expect(first(_results.messages[0])!.current).toBe(matched);
        expect(first(_results.data.values())).toBe(matched);
    });
    it('AttemptedRemovalOfANonExistentKeyWillBeIgnored', () => {
        const key = 'Adult1';
        _source.removeKey(key);
        expect(_results.messages.length).toBe(0);
    });
    it('BatchOfUniqueUpdates', () => {
        const people = range(1, 100).pipe(map(i => new Person('Name' + i, i)));

        _source.addOrUpdateValues(people);
        expect(_results.messages.length).toBe(1);
        expect(_results.messages[0].adds).toBe(80);

        const filtered = from(people).pipe(
            ixFilter(p => p.age > 20),
            orderBy(p => p.age),
        );
        expect(toArray(from(_results.data.values()).pipe(orderBy(p => p.age)))).toEqual(toArray(filtered));
    });
    it('BatchRemoves', () => {
        const people = range(1, 100).pipe(map(i => new Person('Name' + i, i)));

        _source.addOrUpdateValues(people);
        _source.removeValues(people);

        expect(_results.messages.length).toBe(2);
        expect(_results.messages[0].adds).toBe(80);
        expect(_results.messages[1].removes).toBe(80);
        expect(_results.data.size).toBe(0);
    });
    it('BatchSuccessiveUpdates', () => {
        const people = range(1, 100).pipe(map(i => new Person('Name' + i, i)));
        for (const person of people) {
            _source.addOrUpdate(person);
        }
        expect(_results.messages.length).toBe(80);
        expect(_results.data.size).toBe(80);
        const filtered = people.pipe(ixFilter(p => p.age > 20), orderBy(p => p.age));
        expect(toArray(from(_results.data.values()).pipe(orderBy(p => p.age)))).toEqual(toArray(filtered));
    });

    it('Clear', () => {
        const people = range(1, 100).pipe(map(i => new Person('Name' + i, i)));
        _source.addOrUpdateValues(people);
        _source.clear();

        expect(_results.messages.length).toBe(2);
        expect(_results.messages[0].adds).toBe(80);
        expect(_results.messages[1].removes).toBe(80);
        expect(_results.data.size).toBe(0);
    });
    it('Remove', () => {
        const key = 'Adult1';
        const person = new Person(key, 50);

        _source.addOrUpdate(person);
        _source.remove(person);

        expect(_results.messages.length).toBe(2);
        expect(_results.messages.length).toBe(2);
        expect(_results.messages[0].adds).toBe(1);
        expect(_results.messages[1].removes).toBe(1);
        expect(_results.data.size).toBe(0);
    });
    it('UpdateMatched', () => {
        const key = 'Adult1';
        const newperson = new Person(key, 50);
        const updated = new Person(key, 51);
        _source.addOrUpdate(newperson);
        _source.addOrUpdate(updated);

        expect(_results.messages.length).toBe(2);
        expect(_results.messages[0].adds).toBe(1);
        expect(_results.messages[1].updates).toBe(1);
    });
    it('SameKeyChanges', () => {
        const key = 'Adult1';

        _source.edit(updater => {
            updater.addOrUpdate(new Person(key, 50));
            updater.addOrUpdate(new Person(key, 52));
            updater.addOrUpdate(new Person(key, 53));
            updater.removeKey(key);
        });

        expect(_results.messages.length).toBe(1);
        expect(_results.messages[0].adds).toBe(1);
        expect(_results.messages[0].updates).toBe(2);
        expect(_results.messages[0].removes).toBe(1);
    });
    it('UpdateNotMatched', () => {
        const key = 'Adult1';
        const newperson = new Person(key, 10);
        const updated = new Person(key, 11);

        _source.addOrUpdate(newperson);
        _source.addOrUpdate(updated);

        expect(_results.messages.length).toBe(0);
        expect(_results.data.size).toBe(0);
    });
    it('DuplicateKeyWithMerge', () => {
        const key = 'Adult1';
        const newperson = new Person(key, 30);

        const results = asAggregator(
            merge(_source.connect(), _source.connect())
                .pipe(filter(p => p.age > 20)),
        );
        _source.addOrUpdate(newperson); // previously this would throw an exception

        expect(results.messages.length).toBe(2);
        expect(results.messages[0].adds).toBe(1);
        expect(results.messages[1].updates).toBe(1);
        expect(results.data.size).toBe(1);
    });

});
