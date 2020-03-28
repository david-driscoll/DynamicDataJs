import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISortedChangeSet } from '../../src/cache/ISortedChangeSet';
import { sort, SortComparer } from '../../src/cache/operators/sort';
import { Person } from '../domain/Person';
import { IDisposable } from '../../src/util';
import { bind, bindSort } from '../../src/cache/operators/bind';
import { Subscription } from 'rxjs';
import { randomPersonGenerator } from '../domain/RandomPersonGenerator';
import { first, toArray, range, from } from 'ix/iterable';
import { autoRefresh } from '../../src/cache/operators/autoRefresh';
import { treatMovesAsRemoveAdd } from '../../src/cache/operators/treatMovesAsRemoveAdd';
import { map, orderBy } from 'ix/iterable/operators';


describe('ArrayBindCacheSortedFixture', () => {
    let _collection: Person[];
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _binder: Subscription;
    let _comparer = SortComparer.ascending<Person>('name');

    beforeEach(() => {
        _collection = [];
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _binder = _source.connect()
            .pipe(
                sort(_comparer, undefined, undefined, 25),
                bindSort(_collection),
            )
            .subscribe();
    });

    afterEach(() => {
        _binder.unsubscribe();
        _source.dispose();
    });

    it('AddToSourceAddsToDestination', () => {
        const person = new Person('Adult1', 50);
        _source.addOrUpdate(person);

        expect(_collection.length).toBe(1);
        expect(first(_collection)).toBe(person);
    });

    it('UpdateToSourceUpdatesTheDestination', () => {
        const person = new Person('Adult1', 50);
        const personUpdated = new Person('Adult1', 51);
        _source.addOrUpdate(person);
        _source.addOrUpdate(personUpdated);

        expect(_collection.length).toBe(1);
        expect(first(_collection)).toBe(personUpdated);
    });

    it('RemoveSourceRemovesFromTheDestination', () => {
        const person = new Person('Adult1', 50);
        _source.addOrUpdate(person);
        _source.remove(person);

        expect(_collection.length).toBe(0);
    });

    it('BatchAdd', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        expect(_collection.length).toBe(100);
        expect(_collection).toEqual(_collection);
    });

    it('BatchRemove', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);
        _source.clear();
        expect(_collection.length).toBe(0);
    });

    it('CollectionIsInSortOrder', () => {
        _source.addOrUpdateValues(randomPersonGenerator(100));
        const sorted = toArray(from(_source.values()).pipe(orderBy(p => p, _comparer)));
        expect(sorted).toEqual(_collection);
    });

    it('TreatMovesAsRemoveAdd', () => {
        const cache = updateable(new SourceCache<Person, string>(p => p.name));

        const people = toArray(range(0, 10)
            .pipe(map(age => new Person('Person' + age, age))),
        );
        const importantGuy = first(people)!;
        cache.addOrUpdateValues(people);

        let latestSetWithoutMoves: ISortedChangeSet<Person, string> = undefined!;
        let latestSetWithMoves: ISortedChangeSet<Person, string> = undefined!;

        const boundList1: Person[] = [];
        const boundList2: Person[] = [];

        const connection = cache.connect()
            .pipe(
                autoRefresh('age'),
                sort(SortComparer.ascending<Person>('age')),
                treatMovesAsRemoveAdd(),
                bindSort(boundList1),
            )
            .subscribe(set => latestSetWithoutMoves = set);

        const autoRefreshConnection = cache.connect()
            .pipe(
                autoRefresh('age'),
                sort(SortComparer.ascending<Person>('age')),
                bindSort(boundList2),
            )
            .subscribe(set => latestSetWithMoves = set);


        importantGuy.age = importantGuy.age + 200;

        expect(latestSetWithoutMoves.removes).toBe(1);
        expect(latestSetWithoutMoves.adds).toBe(1);
        expect(latestSetWithoutMoves.moves).toBe(0);
        expect(latestSetWithoutMoves.updates).toBe(0);

        expect(latestSetWithMoves.moves).toBe(1);
        expect(latestSetWithMoves.updates).toBe(0);
        expect(latestSetWithMoves.removes).toBe(0);
        expect(latestSetWithMoves.adds).toBe(0);

    });
});