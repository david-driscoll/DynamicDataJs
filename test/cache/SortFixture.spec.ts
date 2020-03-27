import { sort, SortComparer } from '../../src/cache/operators/sort';
import { Person } from '../domain/Person';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { IDisposable } from '../../src/util/Disposable';
import { BehaviorSubject, Subject } from 'rxjs';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { ISortedChangeSet } from '../../src/cache/ISortedChangeSet';
import { Comparer, defaultComparer } from '../../src/cache/Comparer';
import { randomPersonGenerator } from '../domain/RandomPersonGenerator';
import { first, from, last, toArray } from 'ix/iterable';
import { filter, filterDynamic } from '../../src/cache/operators/filter';
import { groupOn } from '../../src/cache/operators/groupOn';
import { transform } from '../../src/cache/operators/transform';
import { map, orderBy, skip } from 'ix/iterable/operators';
import { indexed } from '../util/indexed';

describe('SortFixtureWithReorder', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string, ISortedChangeSet<Person, string>>;
    let _comparer: Comparer<Person>;

    beforeEach(() => {
        _comparer = SortComparer.ascending<Person>('age').thenByAscending('name');
        _source = updateable(new SourceCache<Person, string>((p => p.key)));
        _results = asAggregator(_source.connect().pipe(sort(_comparer)));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('DoesNotThrow1', () => {
        const cache = new SourceCache<Data, number>(d => d.id);
        const sortPump = new Subject<unknown>();
        const disposable = cache.connect()
            .pipe(sort(SortComparer.ascending<Data>('id'), undefined, sortPump))
            .subscribe();

        disposable.unsubscribe();
    });

    it('DoesNotThrow2', () => {
        const cache = new SourceCache<Data, number>(d => d.id);
        const disposable = cache.connect()
            .pipe(sort(undefined, new BehaviorSubject<Comparer<Data>>(SortComparer.ascending<Data>('id'))))
            .subscribe();

        disposable.unsubscribe();
    });


    class Data {
        constructor(public readonly id: number, public readonly  value: string) {
        }
    }

    class TestString {
        public constructor(public readonly name: string) {
        }
    }

    class ViewModel {
        constructor(public readonly  name: string) {
        }

        public static comparer = function comparer(a: ViewModel, b: ViewModel) {
            return a?.name.toLowerCase() === b?.name.toLowerCase() ? 0 as const : a?.name.toLowerCase() > b?.name.toLowerCase() ? 1 as const : -1 as const;
        };
    }

    it('SortAfterFilter', () => {
        const source = new SourceCache<Person, string>(p => p.key);

        const filterSubject = new BehaviorSubject<(person: Person) => boolean>(p => true);

        const agg = asAggregator(source.connect()
            .pipe(
                filterDynamic(filterSubject),
                groupOn(z => z.key),
                transform(z => new ViewModel(z.key)),
                sort(ViewModel.comparer),
            ));

        source.edit(x => {
            x.addOrUpdate(new Person('A', 1, 'F'));
            x.addOrUpdate(new Person('a', 1, 'M'));
            x.addOrUpdate(new Person('B', 1, 'F'));
            x.addOrUpdate(new Person('b', 1, 'M'));
        });

        filterSubject.next(p => p.name.toLowerCase() === 'a');
    });

    it('SortInitialBatch', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        expect(_results.data.size).toBe(100);

        const expectedResult = toArray(from(people).pipe(orderBy(p => p, _comparer), map(p => [p.name, p] as const)));
        const actualResult = toArray(_results.messages[0].sortedItems);

        expect(actualResult).toEqual(expectedResult);
    });

    it('AppendAtBeginning', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const insert = new Person('_Aaron', 0);

        _source.addOrUpdate(insert);

        expect(_results.data.size).toBe(101);
        const indexedItem = indexed(_results.messages[1].sortedItems).get('_Aaron')!;

        expect(indexedItem).toBeDefined();
        expect(indexedItem.index).toBe(0);
    });

    it('AppendInMiddle', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const insert = new Person('Marvin', 50);

        _source.addOrUpdate(insert);

        expect(_results.data.size).toBe(101);
        const indexedItem = indexed(_results.messages[1].sortedItems).get('Marvin');

        expect(indexedItem).toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('AppendAtEnd', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const insert = new Person('zzzzz', 1000);

        _source.addOrUpdate(insert);

        expect(_results.data.size).toBe(101);
        const indexedItem = indexed(_results.messages[1].sortedItems).get('zzzzz');

        expect(indexedItem).toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('RemoveFirst', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const remove = first(_results.messages[0].sortedItems)!;

        _source.removeKey(remove[0]);

        expect(_results.data.size).toBe(99);
        //TODO: fixed Text
        const indexedItem = indexed(_results.messages[1].sortedItems).get(remove[0]);
        expect(indexedItem).not.toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('RemoveFromMiddle', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const remove = first(from(_results.messages[0].sortedItems).pipe(skip(50)))!;

        _source.removeKey(remove[0]);

        expect(_results.data.size).toBe(99);

        //TODO: fixed Text
        const indexedItem = indexed(_results.messages[1].sortedItems).get(remove[0]);
        expect(indexedItem).not.toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('RemoveFromEnd', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const remove = last(_results.messages[0].sortedItems)!;

        _source.removeKey(remove[0]);

        expect(_results.data.size).toBe(99);

        const indexedItem = indexed(_results.messages[1].sortedItems).get(remove[0]);
        expect(indexedItem).not.toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('UpdateFirst', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        const toupdate = first(_results.messages[0].sortedItems)![1];
        const update = new Person(toupdate.name, toupdate.age + 5);

        _source.addOrUpdate(update);

        expect(_results.data.size).toBe(100);
        //TODO: fixed Text
        const indexedItem = indexed(_results.messages[1].sortedItems).get(update.key)!;
        expect(indexedItem).toBeDefined();
        expect(update).toBe(indexedItem.value);
        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('UpdateMiddle', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        const toupdate = first(from(_results.messages[0].sortedItems).pipe(skip(50)))![1];
        const update = new Person(toupdate.name, toupdate.age + 5);

        _source.addOrUpdate(update);

        expect(_results.data.size).toBe(100);

        const indexedItem = indexed(_results.messages[1].sortedItems).get(update.key)!;

        expect(indexedItem).toBeDefined();
        expect(update).toBe(indexedItem.value);
        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('UpdateLast', () => {
        //TODO: fixed Text

        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        const toupdate = last(_results.messages[0].sortedItems)![1];
        const update = new Person(toupdate.name, toupdate.age + 5);

        _source.addOrUpdate(update);

        expect(_results.data.size).toBe(100);
        const indexedItem = indexed(_results.messages[1].sortedItems).get(update.key)!;

        expect(indexedItem).toBeDefined();
        expect(update).toBe(indexedItem.value);
        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });
});

describe('SortFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string, ISortedChangeSet<Person, string>>;
    let _comparer: Comparer<Person>;

    beforeEach(() => {
        _comparer = SortComparer.ascending<Person>('age').thenByAscending('name');

        _source = updateable(new SourceCache<Person, string>((p => p.key)));
        _results = asAggregator(_source.connect().pipe(sort(_comparer)),
        );
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('DoesNotThrow1', () => {
        const cache = new SourceCache<Data, number>(d => d.id);
        const sortPump = new Subject<unknown>();
        const disposable = cache.connect()
            .pipe(sort(SortComparer.ascending<Data>('id'), undefined, sortPump))
            .subscribe();

        disposable.unsubscribe();
    });
    it('DoesNotThrow2', () => {
        const cache = new SourceCache<Data, number>(d => d.id);
        const disposable = cache.connect()
            .pipe(sort(undefined, new BehaviorSubject<Comparer<Data>>(SortComparer.ascending<Data>('id'))))
            .subscribe();

        disposable.unsubscribe();
    });

    class Data {
        constructor(public readonly id: number, public readonly  value: string) {
        }
    }

    class TestString {
        public constructor(public readonly name: string) {
        }
    }

    class ViewModel {
        constructor(public readonly  name: string) {
        }

        public static comparer = function comparer(a: ViewModel, b: ViewModel) {
            return a?.name.toLowerCase() === b?.name.toLowerCase() ? 0 as const : a?.name.toLowerCase() > b?.name.toLowerCase() ? 1 as const : -1 as const;
        };
    }

    it('SortAfterFilter', () => {
        const source = new SourceCache<Person, string>(p => p.key);

        const filterSubject = new BehaviorSubject<(person: Person) => boolean>(p => true);

        const agg = asAggregator(source.connect()
            .pipe(
                filterDynamic(filterSubject),
                groupOn(z => z.key),
                transform(z => new ViewModel(z.key)),
                sort(ViewModel.comparer),
            ));

        source.edit(x => {
            x.addOrUpdate(new Person('A', 1, 'F'));
            x.addOrUpdate(new Person('a', 1, 'M'));
            x.addOrUpdate(new Person('B', 1, 'F'));
            x.addOrUpdate(new Person('b', 1, 'M'));
        });

        filterSubject.next(p => p.name.toLowerCase() === 'a');
    });

    it('SortInitialBatch', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        expect(_results.data.size).toBe(100);

        const expectedResult = toArray(from(people).pipe(orderBy(p => p, _comparer), map(p => [p.name, p] as const)));
        const actualResult = toArray(_results.messages[0].sortedItems);

        expect(actualResult).toEqual(expectedResult);
    });

    it('AppendAtBeginning', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const insert = new Person('_Aaron', 0);

        _source.addOrUpdate(insert);

        expect(_results.data.size).toBe(101);
        const indexedItem = indexed(_results.messages[1].sortedItems).get('_Aaron')!;

        expect(indexedItem).toBeDefined();
        expect(indexedItem.index).toBe(0);
    });

    it('AppendInMiddle', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const insert = new Person('Marvin', 50);

        _source.addOrUpdate(insert);

        expect(_results.data.size).toBe(101);
        const indexedItem = indexed(_results.messages[1].sortedItems).get('Marvin');

        expect(indexedItem).toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('AppendAtEnd', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const insert = new Person('zzzzz', 1000);

        _source.addOrUpdate(insert);

        expect(_results.data.size).toBe(101);
        const indexedItem = indexed(_results.messages[1].sortedItems).get('zzzzz');

        expect(indexedItem).toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('RemoveFirst', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const remove = first(_results.messages[0].sortedItems)!;

        _source.removeKey(remove[0]);

        expect(_results.data.size).toBe(99);
        //TODO: fixed Text
        const indexedItem = indexed(_results.messages[1].sortedItems).get(remove[0]);
        expect(indexedItem).not.toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('RemoveFromMiddle', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const remove = first(from(_results.messages[0].sortedItems).pipe(skip(50)))!;

        _source.removeKey(remove[0]);

        expect(_results.data.size).toBe(99);

        //TODO: fixed Text
        const indexedItem = indexed(_results.messages[1].sortedItems).get(remove[0]);
        expect(indexedItem).not.toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('RemoveFromEnd', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        //create age 0 to ensure it is inserted first
        const remove = last(_results.messages[0].sortedItems)!;

        _source.removeKey(remove[0]);

        expect(_results.data.size).toBe(99);

        const indexedItem = indexed(_results.messages[1].sortedItems).get(remove[0]);
        expect(indexedItem).not.toBeDefined();

        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('UpdateFirst', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        const toupdate = first(_results.messages[0].sortedItems)![1];
        const update = new Person(toupdate.name, toupdate.age + 5);

        _source.addOrUpdate(update);

        expect(_results.data.size).toBe(100);
        //TODO: fixed Text
        const indexedItem = indexed(_results.messages[1].sortedItems).get(update.key)!;
        expect(indexedItem).toBeDefined();
        expect(update).toBe(indexedItem.value);
        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('UpdateMiddle', () => {
        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        const toupdate = first(from(_results.messages[0].sortedItems).pipe(skip(50)))![1];
        const update = new Person(toupdate.name, toupdate.age + 5);

        _source.addOrUpdate(update);

        expect(_results.data.size).toBe(100);

        const indexedItem = indexed(_results.messages[1].sortedItems).get(update.key)!;

        expect(indexedItem).toBeDefined();
        expect(update).toBe(indexedItem.value);
        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });

    it('UpdateLast', () => {
        //TODO: fixed Text

        const people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        const toupdate = last(_results.messages[0].sortedItems)![1];
        const update = new Person(toupdate.name, toupdate.age + 5);

        _source.addOrUpdate(update);

        expect(_results.data.size).toBe(100);
        const indexedItem = indexed(_results.messages[1].sortedItems).get(update.key)!;

        expect(indexedItem).toBeDefined();
        expect(update).toBe(indexedItem.value);
        const list = toArray(_results.messages[1].sortedItems);
        const sortedResult = toArray(from(list).pipe(orderBy(x => x[1], _comparer)));
        expect(list).toEqual(sortedResult);
    });
});