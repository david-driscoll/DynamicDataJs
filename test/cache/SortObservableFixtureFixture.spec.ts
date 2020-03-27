import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { Person } from '../domain/Person';
import { BehaviorSubject } from 'rxjs';
import { Comparer, defaultComparer } from '../../src/cache/Comparer';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { sort, SortComparer } from '../../src/cache/operators/sort';
import { randomPersonGenerator } from '../domain/RandomPersonGenerator';
import { ISortedChangeSet } from '../../src/cache/ISortedChangeSet';
import { toArray, range, from, last } from 'ix/iterable';
import { map, orderBy, orderByDescending, take } from 'ix/iterable/operators';
import faker from 'faker';

describe('SortObservableFixture', () => {
    let _cache: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string, ISortedChangeSet<Person, string>>;
    let _comparerObservable: BehaviorSubject<Comparer<Person>>;
    let _comparer: Comparer<Person>;

    beforeEach(() => {
        _comparer = SortComparer.ascending<Person>('name').thenByAscending('age');
        _comparerObservable = new BehaviorSubject<Comparer<Person>>(_comparer);
        _cache = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(_cache.connect().pipe(sort(undefined, _comparerObservable, undefined, 25)));
    });

    afterEach(() => {
        _cache.dispose();
        _results.dispose();
        _comparerObservable.complete();
    });

    it('SortInitialBatch', () => {
        const people = toArray(randomPersonGenerator(100, 1234));
        _cache.addOrUpdateValues(people);

        expect(_results.data.size).toBe(100);

        const expectedResult = toArray(from(people).pipe(orderBy(p => p, _comparer), map(p => [p.name, p] as const)));
        const actualResult = toArray(_results.messages[0].sortedItems);

        expect(actualResult).toEqual(expectedResult);
    });

    it('ChangeSort', () => {
        const people = toArray(randomPersonGenerator(100, 1234));
        _cache.addOrUpdateValues(people);

        const desc = SortComparer.descending<Person>('age').thenByAscending('name');

        _comparerObservable.next(desc);
        const expectedResult = toArray(from(people).pipe(orderBy(p => p, desc), map(p => [p.name, p] as const)));
        const items = last(_results.messages)!.sortedItems;
        const actualResult = toArray(items);
        const movesCount = _results.messages[0].moves;

        expect(actualResult).toEqual(expectedResult);
    });

    it('ChangeSortWithinThreshold', () => {
        const people = toArray(randomPersonGenerator(20, 1234));
        _cache.addOrUpdateValues(people);

        const desc = SortComparer.descending<Person>('age').thenByAscending('name');

        _comparerObservable.next(desc);
        const expectedResult = toArray(from(people).pipe(orderBy(p => p, desc), map(p => [p.name, p] as const)));
        const items = last(_results.messages)!.sortedItems;
        const actualResult = toArray(items);
        const sortReason = items.sortReason;

        expect(actualResult).toEqual(expectedResult);
        expect(sortReason).toBe('reorder');
    });

    it('ChangeSortAboveThreshold', () => {
        const people = toArray(randomPersonGenerator(30, 1234));
        _cache.addOrUpdateValues(people);

        const desc = SortComparer.descending<Person>('age').thenByAscending('name');

        _comparerObservable.next(desc);
        const expectedResult = toArray(from(people).pipe(orderBy(p => p, desc), map(p => [p.name, p] as const)));
        const items = last(_results.messages)!.sortedItems;
        const actualResult = toArray(items);
        const sortReason = items.sortReason;
        expect(actualResult).toEqual(expectedResult);
        expect(sortReason).toBe('reset');
    });

    it('Reset', () => {
        const people = toArray(range(1, 100).pipe(map(i => new Person('P' + i, i)), orderBy(x => Math.random())));
        _cache.addOrUpdateValues(people);
        _comparerObservable.next(SortComparer.ascending<Person>('age'));
        _comparerObservable.next(_comparer);

        const expectedResult = toArray(from(people).pipe(orderBy(p => p, _comparer), map(p => [p.name, p] as const)));
        const actualResult = toArray(_results.messages[2].sortedItems);
        expect(actualResult).toEqual(expectedResult);
    });
});