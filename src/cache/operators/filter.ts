import { merge, MonoTypeOperatorFunction, Observable, Subscription } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { Cache } from '../Cache';
import { map, scan } from 'rxjs/operators';
import { notEmpty } from './notEmpty';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';
import { ChangeSet } from '../ChangeSet';

/**
 * Creates a filtered stream which can be dynamically filtered
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param predicateChanged Observable to change the underlying predicate.
 * @param reapplyFilter Observable to re-evaluate whether the filter still matches items. Use when filtering on mutable values
 */
export function filterDynamic<TObject, TKey>(
    predicateChanged: Observable<(value: TObject) => boolean>,
    reapplyFilter?: Observable<unknown>,
): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
/**
 * Creates a filtered stream which can be dynamically filtered
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param predicateChanged Observable to change the underlying predicate.
 * @param reapplyFilter Observable to re-evaluate whether the filter still matches items. Use when filtering on mutable values
 */
export function filterDynamic<TObject, TKey>(predicateChanged: Observable<unknown>, reapplyFilter?: Observable<unknown>): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
/**
 * Creates a filtered stream which can be dynamically filtered
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param predicateChanged Observable to change the underlying predicate.
 * @param reapplyFilter Observable to re-evaluate whether the filter still matches items. Use when filtering on mutable values
 */
export function filterDynamic<TObject, TKey>(
    predicateChanged: Observable<unknown | ((value: TObject, key: TKey) => boolean)>,
    reapplyFilter?: Observable<unknown>,
): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function filterOperator(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const allData = new Cache<TObject, TKey>();
            const filteredData = new ChangeAwareCache<TObject, TKey>();
            let predicate = function (value: TObject, key: TKey) {
                return false;
            };

            const refresher = latestPredicateObservable().pipe(
                map(p => {
                    //reapply filter using all data from the cache
                    predicate = p;
                    return refreshFilteredFrom(filteredData, allData, p);
                }),
            );

            const dataChanged = source.pipe(
                map(changes => {
                    //maintain all data [required to re-apply filter]
                    allData.clone(changes);

                    //maintain filtered data
                    filterChanges(filteredData, changes, predicate);

                    //get latest changes
                    return filteredData.captureChanges();
                }),
            );

            return merge(refresher, dataChanged).pipe(notEmpty()).subscribe(observer);
        });

        function latestPredicateObservable(): Observable<(value: TObject, key: TKey) => boolean> {
            return new Observable<(value: TObject, key: TKey) => boolean>(observable => {
                let latest = function (value: TObject, key: TKey) {
                    return false;
                };

                observable.next(latest);

                const predicateChangedSub = predicateChanged.pipe(map(z => (typeof z === 'function' ? z : (value: TObject, key: TKey) => true))).subscribe(predicate => {
                    latest = predicate as any;
                    observable.next(latest);
                });

                const reapplierSub = reapplyFilter == undefined ? Subscription.EMPTY : reapplyFilter.subscribe(_ => observable.next(latest));

                return () => {
                    predicateChangedSub.unsubscribe();
                    reapplierSub.unsubscribe();
                };
            });
        }
    };
}

/**
 *  Filters the specified source.
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param predicate The filter.
 */
export function filter<TObject, TKey>(predicate: (value: TObject) => boolean): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function filterOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        return source.pipe(
            scan((cache, changes) => {
                filterChanges(cache, changes, predicate);
                return cache;
            }, new ChangeAwareCache<TObject, TKey>()),
            map(cache => cache.captureChanges()),
            notEmpty(),
        );
    };
}

function refreshFilteredFrom<TObject, TKey>(
    filtered: ChangeAwareCache<TObject, TKey>,
    allData: Cache<TObject, TKey>,
    predicate: (value: TObject, key: TKey) => boolean,
): IChangeSet<TObject, TKey> {
    if (allData.size == 0) {
        return ChangeSet.empty<TObject, TKey>();
    }

    for (const [key, value] of allData.entries()) {
        const exisiting = filtered.lookup(key);
        const matches = predicate(value, key);

        if (matches) {
            if (!exisiting) {
                filtered.add(value, key);
            }
        } else {
            if (exisiting) {
                filtered.removeKey(key);
            }
        }
    }

    return filtered.captureChanges();
}

function filterChanges<TObject, TKey>(cache: ChangeAwareCache<TObject, TKey>, changes: IChangeSet<TObject, TKey>, predicate: (value: TObject, key: TKey) => boolean) {
    for (const change of changes) {
        const key = change.key;
        switch (change.reason) {
            case 'add':
                {
                    const current = change.current;
                    if (predicate(current, key)) {
                        cache.addOrUpdate(current, key);
                    } else {
                        cache.removeKey(key);
                    }
                }

                break;
            case 'update':
                {
                    const current = change.current;
                    if (predicate(current, key)) {
                        cache.addOrUpdate(current, key);
                    } else {
                        cache.removeKey(key);
                    }
                }

                break;
            case 'remove':
                cache.removeKey(key);
                break;
            case 'refresh':
                {
                    const exisiting = cache.lookup(key);
                    if (predicate(change.current, key)) {
                        if (!exisiting) {
                            cache.addOrUpdate(change.current, key);
                        } else {
                            cache.refreshKey(key);
                        }
                    } else {
                        if (exisiting) {
                            cache.removeKey(key);
                        }
                    }
                }

                break;
        }
    }
}
