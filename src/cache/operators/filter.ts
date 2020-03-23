import { merge, MonoTypeOperatorFunction, Observable, Subscription } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { Cache } from '../Cache';
import { map, scan } from 'rxjs/operators';
import { notEmpty } from './notEmpty';
import { filterChanges } from './filterChanges';
import { refreshFilteredFrom } from './refreshFilteredFrom';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 *  Creates a filtered stream which can be dynamically filtered
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param predicateChanged Observable to change the underlying predicate.
 * @param reapplyFilter Observable to re-evaluate whether the filter still matches items. Use when filtering on mutable values
 */
export function filterDynamic<TObject, TKey>(
    predicateChanged: Observable<(value: TObject) => boolean>,
    reapplyFilter?: Observable<never>,
): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function filterOperator(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const allData = new Cache<TObject, TKey>();
            const filteredData = new ChangeAwareCache<TObject, TKey>();
            let predicate: ((value: TObject) => boolean) = t => false;

            const refresher = latestPredicateObservable()
                .pipe(map(p => {
                    //set the local predicate
                    predicate = p;

                    //reapply filter using all data from the cache
                    return refreshFilteredFrom(filteredData, allData, predicate);
                }));

            const dataChanged = source
                .pipe(map(changes => {
                    //maintain all data [required to re-apply filter]
                    allData.clone(changes);

                    //maintain filtered data
                    filterChanges(filteredData, changes, predicate);

                    //get latest changes
                    return filteredData.captureChanges();
                }));

            return merge(refresher, dataChanged)
                .pipe(notEmpty())
                .subscribe(observer);
        });

        function latestPredicateObservable(): Observable<(value: TObject) => boolean> {
            return new Observable<(value: TObject) => boolean>(observable => {
                let latest: (value: TObject) => boolean = t => false;

                observable.next(latest);

                const predicateChangedSub = predicateChanged
                    .subscribe(predicate => {
                        latest = predicate;
                        observable.next(latest);
                    });

                const reapplierSub = reapplyFilter == undefined
                    ? Subscription.EMPTY
                    : reapplyFilter.subscribe(_ => observable.next(latest));

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
        return source
            .pipe(scan((cache, changes) => {
                    filterChanges(cache, changes, predicate);
                    return cache;
                }, new ChangeAwareCache<TObject, TKey>()),
                map(cache => cache.captureChanges()),
                notEmpty(),
            );
    };
}
