import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { Person } from '../domain/Person';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { groupOn } from '../../src/cache/operators/groupOn';
import { Group } from '../../src/cache/IGroupChangeSet';
import { count, first, from, range, toArray } from 'ix/iterable';
import { groupBy, map, skip } from 'ix/iterable/operators';

describe('GroupImmutableFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Group<Person, string, number>, number>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(_source.connect().pipe(groupOn(z => z.age)));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('Add', () => {

        _source.addOrUpdate(new Person('Person1', 20));
        expect(_results.data.size).toBe(1);
        expect(first(_results.messages)!.adds).toBe(1);
    });

    it('UpdatesArePermissible', () => {
        _source.addOrUpdate(new Person('Person1', 20));
        _source.addOrUpdate(new Person('Person2', 20));

        expect(_results.data.size).toBe(1);//1 group
        expect(first(_results.messages)!.adds).toBe(1);
        expect(first(from(_results.messages).pipe(skip(1)))!.updates).toBe(1);

        const group = first(_results.data.values())!;
        expect(count(group)).toBe(2);
    });

    it('UpdateAnItemWillChangedThegroup', () => {
        _source.addOrUpdate(new Person('Person1', 20));
        _source.addOrUpdate(new Person('Person1', 21));

        expect(_results.data.size).toBe(1);
        expect(first(_results.messages)!.adds).toBe(1);
        expect(first(from(_results.messages).pipe(skip(1)))!.adds).toBe(1);
        expect(first(from(_results.messages).pipe(skip(1)))!.removes).toBe(1);
        const group = first(_results.data.values())!;
        expect(count(group)).toBe(1);

        expect(group?.key).toBe(21);
    });

    it('Remove', () => {
        _source.addOrUpdate(new Person('Person1', 20));
        _source.remove(new Person('Person1', 20));

        expect(_results.messages.length).toBe(2);
        expect(_results.data.size).toBe(0);
    });

    it('FiresManyValueForBatchOfDifferentAdds', () => {
        _source.edit(updater => {
            updater.addOrUpdate(new Person('Person1', 20));
            updater.addOrUpdate(new Person('Person2', 21));
            updater.addOrUpdate(new Person('Person3', 22));
            updater.addOrUpdate(new Person('Person4', 23));
        });

        expect(_results.data.size).toBe(4);
        expect(_results.messages.length).toBe(1);
        expect(first(_results.messages)!.size).toBe(4);
        for (const update of first(_results.messages)!) {
            expect(update.reason).toBe('add');
        }
    });

    it('FiresOnlyOnceForABatchOfUniqueValues', () => {
        _source.edit(updater => {
            updater.addOrUpdate(new Person('Person1', 20));
            updater.addOrUpdate(new Person('Person2', 20));
            updater.addOrUpdate(new Person('Person3', 20));
            updater.addOrUpdate(new Person('Person4', 20));
        });

        expect(_results.messages.length).toBe(1);
        expect(first(_results.messages)!.adds).toBe(1);
        expect(count(first(_results.data.values())!)).toBe(4);
    });

    it('ChanegMultipleGroups', () => {
        const initialPeople = range(1, 100)
            .pipe(map(i => new Person('Person' + i, i % 10)));

        _source.addOrUpdateValues(initialPeople);

        initialPeople
            .pipe(groupBy(z => z.age))
            .forEach(group => {
                const cache = _results.data.lookup(group.key)!;
                expect(toArray(cache)).toEqual(group);
            });

        const changedPeople = range(1, 100)
            .pipe(map(i => new Person('Person' + i, i % 5)));

        _source.addOrUpdateValues(changedPeople);

        changedPeople
            .pipe(groupBy(z => z.age))
            .forEach(group => {
                const cache = _results.data.lookup(group.key)!;
                expect(toArray(cache)).toEqual(group);
            });

        expect(_results.messages.length).toBe(2);
        expect(first(_results.messages)!.adds).toBe(10);
        expect(first(from(_results.messages).pipe(skip(1)))!.removes).toBe(5);
        expect(first(from(_results.messages).pipe(skip(1)))!.updates).toBe(5);
    });

    it('Reevaluate', () => {
        const initialPeople = range(1, 10)
            .pipe(map(i => new Person('Person' + i, i % 2)));

        _source.addOrUpdateValues(initialPeople);
        expect(_results.messages.length).toBe(1);

        //do an inline update
        for (const person of initialPeople) {
            person.age = person.age + 1;
        }            //signal operators to evaluate again
        _source.refresh();

        initialPeople
            .pipe(groupBy(z => z.age))
            .forEach(group => {
                const cache = _results.data.lookup(group.key)!;
                expect(toArray(cache)).toEqual(group);
            });

        expect(_results.data.size).toBe(2);
        expect(_results.messages.length).toBe(2);

        const secondMessage = first(from(_results.messages).pipe(skip(1)))!;
        expect(secondMessage.removes).toBe(1);
        expect(secondMessage.updates).toBe(1);
        expect(secondMessage.adds).toBe(1);
    });
});