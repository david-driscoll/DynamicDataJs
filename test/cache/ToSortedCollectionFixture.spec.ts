import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { Person } from '../domain/Person';
import { CompositeDisposable } from '../../src/util';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { range, toArray, from } from 'ix/iterable';
import { map, orderBy, orderByDescending } from 'ix/iterable/operators';
import { TestScheduler } from 'rxjs/testing';
import { observeOn, tap } from 'rxjs/operators';
import { sort } from '../../src/cache/operators/sort';
import { toCollection } from '../../src/cache/operators/toCollection';
import { toSortedCollection } from '../../src/cache/operators/toSortedCollection';
import { defaultComparer } from '../../src/cache/Comparer';

describe('ToSortedCollectionFixture', () => {
    let _cache: ISourceCache<Person, number> & ISourceUpdater<Person, number>;
    let _sortedCollection: Person[] = [];
    let _unsortedCollection: Person[] = [];
    let _cleanup: CompositeDisposable;

    beforeEach(() => {
        _cache = updateable(new SourceCache<Person, number>(p => p.age));
        _cache.addOrUpdateValues(range(1, 10).pipe(map(i => new Person('Name' + i, i))));
        _cleanup = new CompositeDisposable();
    });

    afterEach(() => {
        _cache.dispose();
        _cleanup.dispose();
    });

    it('SortAscending', () => {
        _cleanup.add(_cache.connect()
            .pipe(
                // observeOn(testScheduler),
                sort(),
                toCollection(),
                tap(persons => {
                    _unsortedCollection.splice(0, _unsortedCollection.length, ...persons);
                }),
            )
            .subscribe(),
        );

        _cleanup.add(_cache.connect()
            .pipe(
                // observeOn(testScheduler),
                toSortedCollection(z => z.age),
                tap(persons => {
                    _sortedCollection.splice(0, _sortedCollection.length, ...persons);
                }),
            )
            .subscribe(),
        );

        // Insert an item with a lower sort order
        _cache.addOrUpdate(new Person('Name', 0));

        expect(toArray(_cache.values())).toEqual(_unsortedCollection);
        expect(toArray(_cache.values())).not.toEqual(_sortedCollection);
        expect(toArray(from(_cache.values()).pipe(orderBy(z => z.age)))).toEqual(_sortedCollection);
    });

    it('SortDescending', () => {
        _cleanup.add(_cache.connect()
            .pipe(
                // observeOn(testScheduler),
                sort(),
                toCollection(),
                tap(persons => {
                    _unsortedCollection.splice(0, _unsortedCollection.length, ...persons);
                }),
            )
            .subscribe(),
        );

        _cleanup.add(_cache.connect()
            .pipe(
                // observeOn(testScheduler),
                toSortedCollection(z => z.age, 'desc'),
                tap(persons => {
                    _sortedCollection.splice(0, _sortedCollection.length, ...persons);
                }),
            )
            .subscribe(),
        );

        // Insert an item with a lower sort order
        _cache.addOrUpdate(new Person('Name', 0));

        expect(toArray(_cache.values())).toEqual(_unsortedCollection);
        expect(toArray(_cache.values())).not.toEqual(_sortedCollection);
        expect(toArray(from(_cache.values()).pipe(orderByDescending(z => z.age)))).toEqual(_sortedCollection);
    });

});