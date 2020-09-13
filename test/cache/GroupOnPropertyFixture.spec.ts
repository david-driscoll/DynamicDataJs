import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { Person } from '../domain/Person';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { Group } from '../../src/cache/IGroupChangeSet';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { groupOnProperty } from '../../src/cache/operators/groupOnProperty';
import { count, first, from, toArray } from 'ix/iterable';
import { map, filter, distinct, take, flatMap } from 'ix/iterable/operators';
import { randomPersonGenerator } from '../domain/RandomPersonGenerator';

describe('GroupOnPropertyFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Group<Person, string, number>, number>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.key));
        _results = asAggregator(_source.connect().pipe(groupOnProperty('age')));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('CanGroupOnAdds', () => {
        const person = new Person('A', 10);

        _source.addOrUpdate(new Person('A', 10));

        expect(_results.data.size).toBe(1);

        const firstGroup = first(_results.data.values())!;

        expect(firstGroup.cache.size).toBe(1);
        expect(firstGroup.key).toBe(10);
    });

    it('CanRemoveFromGroup', () => {
        const person = new Person('A', 10);
        _source.addOrUpdate(person);
        _source.remove(person);

        expect(_results.data.size).toBe(0);
    });

    it('Regroup', () => {
        const person = new Person('A', 10);
        _source.addOrUpdate(person);
        person.age = 20;

        expect(_results.data.size).toBe(1);
        const firstGroup = first(_results.data.values())!;

        expect(firstGroup.cache.size).toBe(1);
        expect(firstGroup.key).toBe(20);
    });

    it('CanHandleAddBatch', () => {
        const people = from(toArray(randomPersonGenerator(1000)));

        _source.addOrUpdateValues(people);

        const expectedGroupCount = count(
            from(people).pipe(
                map(x => x.age),
                distinct(),
            ),
        );
        expect(_results.data.size).toBe(expectedGroupCount);
    });

    it('CanHandleChangedItemsBatch', async () => {
        const people = from(toArray(randomPersonGenerator(100)));

        _source.addOrUpdateValues(people);

        const initialCount = count(
            people.pipe(
                map(z => z.age),
                distinct({ keySelector: z => z.toString() }),
            ),
        );

        expect(_results.data.size).toBe(initialCount);

        people.pipe(take(25)).forEach(p => (p.age = 200));

        const changedCount = count(
            people.pipe(
                map(z => z.age),
                distinct(),
            ),
        );

        expect(_results.data.size).toBe(changedCount);

        //check that each item is only in one cache
        const peopleInCache = toArray(from(_results.data.values()).pipe(flatMap(g => g.cache.values())));

        expect(peopleInCache.length).toBe(100);
    });
});
