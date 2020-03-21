import { IChangeSet } from '../IChangeSet';
import { MonoTypeOperatorFunction } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Cache } from '../Cache';
import { ISortedChangeSet, isSortedChangeSet } from '../ISortedChangeSet';
import { from, toArray } from 'ix/iterable';
import { map } from 'ix/iterable/operators';
import { stringify } from 'querystring';

export function bind<TObject, TKey>(
    values: TObject[],
    refreshThreshold?: number,
    adapter?: (changes: IChangeSet<TObject, TKey>) => void,
): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    adapter = adapter ?? createAdapter(values, refreshThreshold ?? 25);
    return function bindOperator(source) {
        return source.pipe(tap(adapter!));
    };
}

function createAdapter<TObject, TKey>(values: TObject[], refreshThreshold: number) {
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
                        doSortedUpdate(changes, values);
                    }
                    break;

                case 'reorder':
                    doSortedUpdate(changes, values);
                    break;
            }
            return;
        }
        _cache.clone(changes);

        if (changes.size - changes.refreshes > refreshThreshold || !_loaded) {
            values.splice(0, values.length, ...toArray(_cache.values()));
            _loaded = true;
        } else {
            doUpdate(changes, values);
        }
    };

    function doUpdate(changes: IChangeSet<TObject, TKey>, list: TObject[]) {
        for (const update of changes) {
            switch (update.reason) {
                case 'add':
                    list.push(update.current);
                    break;
                case 'remove':
                    list.splice(list.indexOf(update.current), 1);
                    break;
                case 'update':
                    list.splice(list.indexOf(update.previous!), 1, update.current);
                    break;
            }
        }
    }

    function doSortedUpdate(updates: ISortedChangeSet<TObject, TKey>, list: TObject[]) {
        for (const update of updates) {
            switch (update.reason) {
                case 'add':
                    list.splice(update.currentIndex, 0, update.current);
                    break;
                case 'remove':
                    list.splice(update.currentIndex, 1);
                    break;
                case 'moved':
                    list.splice(update.currentIndex, 0, ...list.splice(update.previousIndex!, 1));
                    break;
                case 'update':
                    list.splice(update.previousIndex!, 1);
                    list.splice(update.currentIndex, 0, update.current);
                    break;
            }
        }
    }
}
