import { IChangeSet } from '../IChangeSet';
import { MonoTypeOperatorFunction, Observable, OperatorFunction } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Cache } from '../Cache';
import { ISortedChangeSet, isSortedChangeSet } from '../ISortedChangeSet';
import { from, toArray } from 'ix/iterable';
import { map } from 'ix/iterable/operators';
import equal from 'fast-deep-equal';

export function bind<TObject, TKey>(
    values: TObject[],
    adapter?: (changes: IChangeSet<TObject, TKey>) => void,
    refreshThreshold?: number,
): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    if (!adapter && Array.isArray(values)) {
        adapter = createBindAdpater(values, (value: TObject, key: TKey) => values.indexOf(value), refreshThreshold ?? 25);
    }
    return function bindOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        return source.pipe(tap(adapter!));
    };
}
export function bindSort<TObject, TKey>(
    values: TObject[],
    adapter?: (changes: ISortedChangeSet<TObject, TKey>) => void,
    refreshThreshold?: number,
): MonoTypeOperatorFunction<ISortedChangeSet<TObject, TKey>> {
    return bind(values, adapter as any, refreshThreshold) as any;
}

bind.indexOfAdapter = function indexOfAdapter<TObject, TKey>(values: TObject[]) {
    return createBindAdpater(values, (value: TObject, key: TKey) => values.indexOf(value));
};

bind.deepEqualAdapter = function findIndexOfAdapter<TObject, TKey>(values: TObject[]) {
    return createBindAdpater(values, (value: TObject, key: TKey) => values.findIndex(v => equal(v, value)));
};

function createBindAdpater<TObject, TKey>(values: TObject[], indexOf: (value: TObject, key: TKey) => number, refreshThreshold = 25) {
    const _cache = new Cache<TObject, TKey>();
    let _loaded = false;
    return function defaultAdapter(changes: IChangeSet<TObject, TKey>) {
        if (isSortedChangeSet(changes)) {
            switch (changes.sortedItems.sortReason) {
                case 'initialLoad':
                case 'comparerChanged':
                case 'reset':
                    values.splice(0, values.length, ...toArray(from(changes.sortedItems.values()).pipe(map(x => x[1]))));
                    break;

                case 'dataChanged':
                    if (changes.size - changes.refreshes > refreshThreshold) {
                        values.splice(0, values.length, ...toArray(from(changes.sortedItems.values()).pipe(map(x => x[1]))));
                    } else {
                        doSortedUpdate(changes);
                    }
                    break;

                case 'reorder':
                    doSortedUpdate(changes);
                    break;
            }
            return;
        }
        _cache.clone(changes);

        if (changes.size - changes.refreshes > refreshThreshold || !_loaded) {
            values.splice(0, values.length, ...toArray(_cache.values()));
            _loaded = true;
        } else {
            doUpdate(changes);
        }
    };

    function doUpdate(changes: IChangeSet<TObject, TKey>) {
        for (const update of changes) {
            switch (update.reason) {
                case 'add':
                    values.push(update.current);
                    break;
                case 'remove': {
                    const index = indexOf(update.current, update.key);
                    if (index > -1) {
                        values.splice(index, 1);
                    }
                    break;
                }
                case 'update': {
                    const index = indexOf(update.previous!, update.key);
                    if (index > -1) {
                        values.splice(index, 1, update.current);
                    }
                }
                    break;
            }
        }
    }

    function doSortedUpdate(updates: ISortedChangeSet<TObject, TKey>) {
        for (const update of updates) {
            switch (update.reason) {
                case 'add':
                    values.splice(update.currentIndex, 0, update.current);
                    break;
                case 'remove':
                    values.splice(update.currentIndex, 1);
                    break;
                case 'moved':
                    values.splice(update.currentIndex, 0, ...values.splice(update.previousIndex!, 1));
                    break;
                case 'update':
                    values.splice(update.previousIndex!, 1);
                    values.splice(update.currentIndex, 0, update.current);
                    break;
            }
        }
    }
}
