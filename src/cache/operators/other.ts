// TODO:
// /**
//  * Removes the key which enables all observable list features of dynamic data
// * @typeparam TObject The type of  object.
// * @typeparam TKey The type of  key.
// */
// export function removeKey<TObject, TKey>(): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
//     return function removeKeyOperator(source) {
//         return source.pipe(
//             map(changes => {
//                 ixFrom(changes).pipe()
//                 return new Change<TObject>()
//             })
//         );
//     }
// }

// /**
//  * Returns the page as specified by the pageRequests observable
//  * @typeparam TObject The type of the object.
//  * @typeparam TKey The type of the key.
//  * @param pageRequests The page requests.
//  */
// export function page<TObject, TKey>(
//     pageRequests: Observable<PageRequest>
// ): OperatorFunction<IChangeSet<TObject, TKey>, IPagedChangeSet<TObject, TKey>> {
//     return function pageOperator(source) {
//         return new Observable<IPagedChangeSet<TObject, TKey>>(observer => {
//             var paginator = new Paginator();
//             var request = pageRequests.pipe(map(paginator.Paginate));
//             var datachange = source.pipe(map(paginator.update));

//             return merge(request, datachange)
//                 .pipe(filter(updates => updates !== undefined))
//                 .subscribe(observer);
//         });
//     };
// }

// public static IObservable<IPagedChangeSet<TObject, TKey>> Page<TObject, TKey>([NotNull] this IObservable<ISortedChangeSet<TObject, TKey>> source,
// [NotNull] IObservable<IPageRequest> pageRequests)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (pageRequests == null)
// {
// throw new ArgumentNullException(nameof(pageRequests));
// }

// return new Page<TObject, TKey>(source, pageRequests).Run();
// }

import {
    MonoTypeOperatorFunction,
    Observable,
    OperatorFunction,
    SchedulerLike,
    queueScheduler,
    interval,
    timer,
    ConnectableObservable,
    merge,
} from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { DistinctChangeSet } from '../DistinctChangeSet';
import { IPagedChangeSet } from '../IPagedChangeSet';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';
import { take, tap, map, filter, publish, finalize } from 'rxjs/operators';
import { transform } from './transform';
import { asObservableCache } from './asObservableCache';
import { from as ixFrom, toArray as ixToArray, some } from 'ix/iterable';
import { filter as ixFilter, map as ixMap, skip as ixSkip, orderByDescending } from 'ix/iterable/operators';
import { Disposable, SingleAssignmentDisposable } from '../../util';
import { ExpirableItem } from '../ExpirableItem';
import { ChangeSet } from '../ChangeSet';
import { notEmpty } from './notEmpty';
import { Change } from '../Change';
import { subscribeMany } from './subscribeMany';
import { IntermediateCache } from '../IntermediateCache';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { PageRequest } from '../PageRequest';

export function distinctValues<TObject, TKey, TValue>(
    valueSelector: (value: TObject) => TValue
): OperatorFunction<IChangeSet<TObject, TKey>, DistinctChangeSet<TValue>> {
    const _valueCounters = new Map<TValue, number>();
    const _keyCounters = new Map<TKey, number>();
    const _itemCache = new Map<TKey, TValue>();

    return function distinctValuesOperator(source) {
        return source.pipe(map(calculate), notEmpty());
    };
    function addKeyAction(key: TKey, value: TValue) {
        const count = _keyCounters.get(key);
        if (count !== undefined) {
            _keyCounters.set(key, count + 1);
        } else {
            _keyCounters.set(key, 1);
            _itemCache.set(key, value);
        }
    }

    function removeKeyAction(key: TKey) {
        var counter = _keyCounters.get(key);
        if (counter === undefined) {
            return;
        }

        //decrement counter
        var newCount = counter - 1;
        _keyCounters.set(key, newCount);
        if (newCount != 0) {
            return;
        }

        //if there are none, then remove from cache
        _keyCounters.delete(key);
        _itemCache.delete(key);
    }

    function calculate(changes: IChangeSet<TObject, TKey>): DistinctChangeSet<TValue> {
        var result = new ChangeSet<TValue, TValue>();

        function addValueAction(value: TValue) {
            const count = _keyCounters.get(key);
            if (count !== undefined) {
                _valueCounters.set(value, count + 1);
            } else {
                _valueCounters.set(value, 1);
                result.add(new Change('add', value, value));
            }
        }

        function removeValueAction(value: TValue) {
            var counter = _valueCounters.get(value);
            if (counter === undefined) {
                return;
            }

            //decrement counter
            var newCount = counter - 1;
            _valueCounters.set(value, newCount);
            if (newCount != 0) {
                return;
            }

            //if there are none, then remove and notify
            _valueCounters.delete(value);
            result.add(new Change('remove', value, value));
        }

        for (var change of changes) {
            var key = change.key;
            switch (change.reason) {
                case 'add': {
                    var value = valueSelector(change.current);
                    addKeyAction(key, value);
                    addValueAction(value);
                    break;
                }
                case 'refresh':
                case 'update': {
                    var value = valueSelector(change.current);
                    var previous = _itemCache.get(key)!;
                    if (value === previous) {
                        continue;
                    }

                    removeValueAction(previous);
                    addValueAction(value);
                    _itemCache.set(key, value);
                    break;
                }
                case 'remove': {
                    var previous = _itemCache.get(key)!;
                    removeKeyAction(key);
                    removeValueAction(previous);
                    break;
                }
            }
        }
        return result;
    }
}

/**
 * Automatically removes items from the stream after the time specified by
 * the timeSelector elapses.  Return null if the item should never be removed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param timeSelector The time selector.
 * @param timerInterval The time interval.
 * @param scheduler The scheduler.
 */
export function forExpiry<TObject, TKey>(
    timeSelector: (value: TObject) => number | undefined,
    timerInterval?: number | undefined,
    scheduler: SchedulerLike = queueScheduler
): OperatorFunction<IChangeSet<TObject, TKey>, Iterable<readonly [TKey, TObject]>> {
    return function forExpiryOperator(source) {
        return new Observable<Iterable<readonly [TKey, TObject]>>(observer => {
            var dateTime = Date.now();

            var autoRemover = asObservableCache(
                source.pipe(
                    tap(x => (dateTime = scheduler.now())),
                    transform((value, previous, key) => {
                        var removeAt = timeSelector(value);
                        var expireAt = removeAt ? dateTime + removeAt : undefined;
                        return <ExpirableItem<TObject, TKey>>{ expireAt, key, value };
                    })
                )
            );

            function removalAction() {
                try {
                    var toRemove = ixFrom(autoRemover.values()).pipe(
                        ixFilter(x => x.expireAt !== undefined && x.expireAt <= scheduler.now()),
                        ixMap(x => [x.key, x.value] as const)
                    );

                    observer.next(toRemove);
                } catch (error) {
                    observer.error(error);
                }
            }

            var removalSubscription = new SingleAssignmentDisposable();
            if (timerInterval) {
                // use polling
                removalSubscription.disposable = interval(timerInterval).subscribe();
            } else {
                //create a timer for each distinct time
                removalSubscription.disposable = autoRemover
                    .connect()
                    .pipe(
                        distinctValues(ei => ei.expireAt),
                        subscribeMany(datetime => {
                            var expireAt = datetime - scheduler.now();
                            return timer(expireAt, scheduler)
                                .pipe(take(1))
                                .subscribe(_ => removalAction());
                        })
                    )
                    .subscribe();
            }

            return Disposable.create(() => {
                removalSubscription.dispose();
                autoRemover.dispose();
            });
        });
    };
}

/**
 * Automatically removes items from the cache after the time specified by
 * the time selector elapses.

* @typeparam TObject The type of the object.
* @typeparam TKey The type of the key.
* @param timeSelector The time selector.  Return null if the item should never be removed
* @param interval The polling interval.  Since multiple timer subscriptions can be expensive, it may be worth setting the interval.
* @param scheduler The scheduler.
*/
export function expireAfter<TObject, TKey>(
    timeSelector: (value: TObject) => number,
    interval?: number,
    scheduler: SchedulerLike = queueScheduler
): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function expireAfterOperator(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            var cache = new IntermediateCache<TObject, TKey>(source);

            const published: ConnectableObservable<IChangeSet<TObject, TKey>> = source.pipe(publish()) as any;
            var subscriber = published.subscribe(observer);

            var autoRemover = published
                .pipe(
                    forExpiry(timeSelector, interval, scheduler),
                    finalize(() => observer.complete())
                )
                .subscribe(keys => {
                    try {
                        cache.edit(updater => updater.removeKeys(ixFrom(keys).pipe(ixMap(([key, _]) => key))));
                    } catch (error) {
                        observer.error(error);
                    }
                });

            var connected = published.connect();

            return Disposable.create(() => {
                connected.unsubscribe();
                subscriber.unsubscribe();
                autoRemover.unsubscribe();
                cache.dispose();
            });
        });
    };
}

/**
 * Applies a size limiter to the number of records which can be included in the
 * underlying cache.  When the size limit is reached the oldest items are removed.
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param size The size.
 */
export function limitSizeTo<TObject, TKey>(size: number): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function limitSizeToOperaor(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            var sizeLimiter = new SizeLimiter<TObject, TKey>(size);
            var root = new IntermediateCache<TObject, TKey>(source);

            var subscriber = root
                .connect()
                .pipe(
                    transform((value, previous, key) => {
                        return <ExpirableItem<TObject, TKey>>{ expireAt: Date.now(), value, key };
                    }),
                    map(changes => {
                        var result = sizeLimiter.change(changes);

                        var removes = ixFrom(result).pipe(ixFilter(c => c.reason === 'remove'));
                        root.edit(updater => removes.forEach(c => updater.removeKey(c.key)));
                        return result;
                    }),
                    finalize(() => observer.complete())
                )
                .subscribe(observer);

            return Disposable.create(() => {
                subscriber.unsubscribe();
                root.dispose();
            });
        });
    };
}

class SizeLimiter<TObject, TKey> {
    private readonly _cache = new ChangeAwareCache<ExpirableItem<TObject, TKey>, TKey>();

    private readonly _sizeLimit: number;

    public constructor(size: number) {
        this._sizeLimit = size;
    }

    public change(updates: IChangeSet<ExpirableItem<TObject, TKey>, TKey>): IChangeSet<TObject, TKey> {
        this._cache.clone(updates);

        var itemstoexpire = ixFrom(this._cache.entries()).pipe(
            orderByDescending(([key, value]) => value.expireAt),
            ixSkip(this._sizeLimit),
            ixMap(([key, value]) => new Change<TObject, TKey>('remove', key, value.value))
        );

        if (some(itemstoexpire, z => true)) {
            this._cache.removeKeys(itemstoexpire.pipe(ixMap(x => x.key)));
        }

        var notifications = this._cache.captureChanges();
        var changed = ixFrom(notifications).pipe(
            ixMap(update => new Change<TObject, TKey>(update.reason, update.key, update.current.value, update.previous?.value))
        );

        return new ChangeSet<TObject, TKey>(changed);
    }

    public CloneAndReturnExpiredOnly(updates: IChangeSet<ExpirableItem<TObject, TKey>, TKey>): TKey[] {
        this._cache.clone(updates);
        this._cache.captureChanges(); //Clear any changes

        return ixToArray(
            ixFrom(this._cache.entries()).pipe(
                orderByDescending(([key, value]) => value.expireAt),
                ixSkip(this._sizeLimit),
                ixMap(x => x[0])
            )
        );
    }
}
// /**
//  * Sorts using the specified comparer.
//  * Returns the underlying ChangeSet as as per the system conventions.
//  * The resulting changeset also exposes a sorted key value collection of of the underlying cached data

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param comparer The comparer.
// * @param sortOptimizations Sort optimization flags. Specify one or more sort optimizations
// * @param resetThreshold The number of updates before the entire list is resorted (rather than inline sort)
// */
export function sort<TObject, TKey>(
    comparer: IComparer<TObject>,
    sortOptimisations: SortOptimizations = 'none',
    comparerChangedObservable?: Observable<IComparer<TObject>>,
    resorter?: Observable<unknown>,
    resetThreshold = -1
) {
    return function sortOperator() {};
}

// #endregion

// #region Sort

// private const int DefaultSortResetThreshold = 100;

// public static IObservable < ISortedChangeSet < TObject, TKey >> Sort<TObject, TKey>(this IObservable < IChangeSet < TObject, TKey >> source,
// IComparer<TObject> comparer,
// SortOptimisations sortOptimisations = SortOptimisations.None,
// int resetThreshold = DefaultSortResetThreshold)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (comparer == null)
// {
// throw new ArgumentNullException(nameof(comparer));
// }

// return new Sort<TObject, TKey>(source, comparer, sortOptimisations, resetThreshold: resetThreshold).Run();
// }

// /**
//  * Sorts a sequence as, using the comparer observable to determine order

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param comparerObservable The comparer observable.
// * @param sortOptimisations The sort optimisations.
// * @param resetThreshold The reset threshold.

// public static IObservable<ISortedChangeSet<TObject, TKey>> Sort<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservable<IComparer<TObject>> comparerObservable,
// SortOptimisations sortOptimisations = SortOptimisations.None,
// int resetThreshold = DefaultSortResetThreshold)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (comparerObservable == null)
// {
// throw new ArgumentNullException(nameof(comparerObservable));
// }

// return new Sort<TObject, TKey>(source, null, sortOptimisations, comparerObservable, resetThreshold: resetThreshold).Run();
// }

// /**
//  * Sorts a sequence as, using the comparer observable to determine order

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param comparerObservable The comparer observable.
// * @param resorter Signal to instruct the algroirthm to re-sort the entire data set
// * @param sortOptimisations The sort optimisations.
// * @param resetThreshold The reset threshold.

// */public static IObservable<ISortedChangeSet<TObject, TKey>> Sort<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservable<IComparer<TObject>> comparerObservable,
// IObservable<Unit> resorter,
// SortOptimisations sortOptimisations = SortOptimisations.None,
// int resetThreshold = DefaultSortResetThreshold)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (comparerObservable == null)
// {
// throw new ArgumentNullException(nameof(comparerObservable));
// }

// return new Sort<TObject, TKey>(source, null, sortOptimisations, comparerObservable, resorter, resetThreshold).Run();
// }

// /**
//  * Sorts a sequence as, using the comparer observable to determine order

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param comparer The comparer to sort on
// * @param resorter Signal to instruct the algroirthm to re-sort the entire data set
// * @param sortOptimisations The sort optimisations.
// * @param resetThreshold The reset threshold.

// public static IObservable<ISortedChangeSet<TObject, TKey>> Sort<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IComparer<TObject> comparer,
// IObservable<Unit> resorter,
// SortOptimisations sortOptimisations = SortOptimisations.None,
// int resetThreshold = DefaultSortResetThreshold)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (resorter == null)
// {
// throw new ArgumentNullException(nameof(resorter));
// }

// return new Sort<TObject, TKey>(source, comparer, sortOptimisations, null, resorter, resetThreshold).Run();
// }

// /**
//  * Converts moves changes to remove + add

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
//  * <returns>the same SortedChangeSets, except all moves are replaced with remove + add.</returns>
// */public static IObservable<ISortedChangeSet<TObject, TKey>> TreatMovesAsRemoveAdd<TObject, TKey>(
// this IObservable<ISortedChangeSet<TObject, TKey>> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// IEnumerable<Change<TObject, TKey>> ReplaceMoves(IChangeSet<TObject, TKey> items)
// {
// foreach (var change in items)
// {
// if (change.Reason == ChangeReason.Moved)
// {
// yield return new Change<TObject, TKey>(
// ChangeReason.Remove,
// change.Key,
// change.Current, change.PreviousIndex);

// yield return new Change<TObject, TKey>(
// ChangeReason.Add,
// change.Key,
// change.Current,
// change.CurrentIndex);
// }
// else
// {
// yield return change;
// }
// }
// }

// return source.Select(changes => new SortedChangeSet<TObject, TKey>(changes.SortedItems, ReplaceMoves(changes)));
// }

// #endregion

// #region   And, or, except

// /**
//  * Applied a logical And operator between the collections i.e items which are in all of the sources are included

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param others The others.
// public static IObservable<IChangeSet<TObject, TKey>> And<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// params IObservable<IChangeSet<TObject, TKey>>[] others)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (others == null || others.Length == 0)
// {
// throw new ArgumentNullException(nameof(others));
// }

// return source.Combine(CombineOperator.And, others);
// }

// /**
//  * Applied a logical And operator between the collections i.e items which are in all of the sources are included

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.
// */public static IObservable<IChangeSet<TObject, TKey>> And<TObject, TKey>(this ICollection<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.And);
// }

// /**
//  * Dynamically apply a logical And operator between the items in the outer observable list.
//  * Items which are in all of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// public static IObservable<IChangeSet<TObject, TKey>> And<TObject, TKey>(this IObservableList<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.And);
// }

// /**
//  * Dynamically apply a logical And operator between the items in the outer observable list.
//  * Items which are in all of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// */public static IObservable<IChangeSet<TObject, TKey>> And<TObject, TKey>(this IObservableList<IObservableCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.And);
// }

// /**
//  * Dynamically apply a logical And operator between the items in the outer observable list.
//  * Items which are in all of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// public static IObservable<IChangeSet<TObject, TKey>> And<TObject, TKey>(this IObservableList<ISourceCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.And);
// }

// /**
//  * Apply a logical Or operator between the collections i.e items which are in any of the sources are included

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param others The others.
// */public static IObservable<IChangeSet<TObject, TKey>> Or<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// params IObservable<IChangeSet<TObject, TKey>>[] others)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (others == null || others.Length == 0)
// {
// throw new ArgumentNullException(nameof(others));
// }

// return source.Combine(CombineOperator.Or, others);
// }

// /**
//  * Apply a logical Or operator between the collections i.e items which are in any of the sources are included

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.
// public static IObservable<IChangeSet<TObject, TKey>> Or<TObject, TKey>(this ICollection<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Or);
// }

// /**
//  * Dynamically apply a logical Or operator between the items in the outer observable list.
//  * Items which are in any of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// */public static IObservable<IChangeSet<TObject, TKey>> Or<TObject, TKey>(this IObservableList<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Or);
// }

// //public static IObservable<IChangeSet<TObject, TKey>> Or<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> sources)
// //{
// //    if (sources == null) throw new ArgumentNullException(nameof(sources));

// //    return sources.Combine(CombineOperator.Or);
// //}

// /**
//  * Dynamically apply a logical Or operator between the items in the outer observable list.
//  * Items which are in any of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// public static IObservable<IChangeSet<TObject, TKey>> Or<TObject, TKey>(this IObservableList<IObservableCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Or);
// }

// /**
//  * Dynamically apply a logical Or operator between the items in the outer observable list.
//  * Items which are in any of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// */public static IObservable<IChangeSet<TObject, TKey>> Or<TObject, TKey>(this IObservableList<ISourceCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Or);
// }

// /**
//  * Apply a logical Xor operator between the collections.
//  * Items which are only in one of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param others The others.
// public static IObservable<IChangeSet<TObject, TKey>> Xor<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// params IObservable<IChangeSet<TObject, TKey>>[] others)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (others == null || others.Length == 0)
// {
// throw new ArgumentNullException(nameof(others));
// }

// return source.Combine(CombineOperator.Xor, others);
// }

// /**
//  * Apply a logical Xor operator between the collections.
//  * Items which are only in one of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.
// */public static IObservable<IChangeSet<TObject, TKey>> Xor<TObject, TKey>(this ICollection<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Xor);
// }

// /**
//  * Dynamically apply a logical Xor operator between the items in the outer observable list.
//  * Items which are only in one of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// public static IObservable<IChangeSet<TObject, TKey>> Xor<TObject, TKey>(this IObservableList<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Xor);
// }

// /**
//  * Dynamically apply a logical Xor operator between the items in the outer observable list.
//  * Items which are in any of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// */public static IObservable<IChangeSet<TObject, TKey>> Xor<TObject, TKey>(this IObservableList<IObservableCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Xor);
// }

// /**
//  * Dynamically apply a logical Xor operator between the items in the outer observable list.
//  * Items which are in any of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// public static IObservable<IChangeSet<TObject, TKey>> Xor<TObject, TKey>(this IObservableList<ISourceCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Xor);
// }

// /**
//  * Dynamically apply a logical Except operator between the collections
//  * Items from the first collection in the outer list are included unless contained in any of the other lists

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param others The others.
// */public static IObservable<IChangeSet<TObject, TKey>> Except<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// params IObservable<IChangeSet<TObject, TKey>>[] others)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (others == null || others.Length == 0)
// {
// throw new ArgumentNullException(nameof(others));
// }

// return source.Combine(CombineOperator.Except, others);
// }

// /**
//  * Dynamically apply a logical Except operator between the collections
//  * Items from the first collection in the outer list are included unless contained in any of the other lists

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The sources.
// */public static IObservable<IChangeSet<TObject, TKey>> Except<TObject, TKey>(this ICollection<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Except);
// }

// /**
//  * Dynamically apply a logical Except operator between the collections
//  * Items from the first collection in the outer list are included unless contained in any of the other lists

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// */public static IObservable<IChangeSet<TObject, TKey>> Except<TObject, TKey>(this IObservableList<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Except);
// }

// /**
//  * Dynamically apply a logical Except operator between the items in the outer observable list.
//  * Items which are in any of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// */public static IObservable<IChangeSet<TObject, TKey>> Except<TObject, TKey>(this IObservableList<IObservableCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Except);
// }

// /**
//  * Dynamically apply a logical Except operator between the items in the outer observable list.
//  * Items which are in any of the sources are included in the result

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// */public static IObservable<IChangeSet<TObject, TKey>> Except<TObject, TKey>(this IObservableList<ISourceCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Combine(CombineOperator.Except);
// }

// private static IObservable<IChangeSet<TObject, TKey>> Combine<TObject, TKey>([NotNull] this IObservableList<IObservableCache<TObject, TKey>> source, CombineOperator type)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return Observable.Create<IChangeSet<TObject, TKey>>(observer =>
// {
// var connections = source.Connect().Transform(x => x.Connect()).AsObservableList();
// var subscriber = connections.Combine(type).SubscribeSafe(observer);
// return new CompositeDisposable(connections, subscriber);
// });
// }

// private static IObservable<IChangeSet<TObject, TKey>> Combine<TObject, TKey>([NotNull] this IObservableList<ISourceCache<TObject, TKey>> source, CombineOperator type)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return Observable.Create<IChangeSet<TObject, TKey>>(observer =>
// {
// var connections = source.Connect().Transform(x => x.Connect()).AsObservableList();
// var subscriber = connections.Combine(type).SubscribeSafe(observer);
// return new CompositeDisposable(connections, subscriber);
// });
// }

// private static IObservable<IChangeSet<TObject, TKey>> Combine<TObject, TKey>([NotNull] this IObservableList<IObservable<IChangeSet<TObject, TKey>>> source, CombineOperator type)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return new DynamicCombiner<TObject, TKey>(source, type).Run();
// }

// private static IObservable<IChangeSet<TObject, TKey>> Combine<TObject, TKey>(this ICollection<IObservable<IChangeSet<TObject, TKey>>> sources, CombineOperator type)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return Observable.Create<IChangeSet<TObject, TKey>>
// (
// observer =>
// {
// void UpdateAction(IChangeSet<TObject, TKey> updates)
// {
// try
// {
// observer.OnNext(updates);
// }
// catch (Exception ex)
// {
// observer.OnError(ex);
// }
// }

// IDisposable subscriber = Disposable.Empty;
// try
// {
// var combiner = new Combiner<TObject, TKey>(type, UpdateAction);
// subscriber = combiner.Subscribe(sources.ToArray());
// }
// catch (Exception ex)
// {
// observer.OnError(ex);
// observer.OnCompleted();
// }

// return subscriber;
// });
// }

// private static IObservable<IChangeSet<TObject, TKey>> Combine<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// CombineOperator type,
// params IObservable<IChangeSet<TObject, TKey>>[] combinetarget)
// {
// if (combinetarget == null)
// {
// throw new ArgumentNullException(nameof(combinetarget));
// }

// return Observable.Create<IChangeSet<TObject, TKey>>
// (
// observer =>
// {
// void UpdateAction(IChangeSet<TObject, TKey> updates)
// {
// try
// {
// observer.OnNext(updates);
// }
// catch (Exception ex)
// {
// observer.OnError(ex);
// observer.OnCompleted();
// }
// }

// IDisposable subscriber = Disposable.Empty;
// try
// {
// var list = combinetarget.ToList();
// list.Insert(0, source);

// var combiner = new Combiner<TObject, TKey>(type, UpdateAction);
// subscriber = combiner.Subscribe(list.ToArray());
// }
// catch (Exception ex)
// {
// observer.OnError(ex);
// observer.OnCompleted();
// }

// return subscriber;
// });
// }

// /**
//  * The equivalent of rx startwith operator, but wraps the item in a change where reason is ChangeReason.Add

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param item The item.

// */public static IObservable<IChangeSet<TObject, TKey>> StartWithItem<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// TObject item) where TObject : IKey<TKey>
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.StartWithItem(item, item.Key);
// }

// /**
//  * The equivalent of rx startwith operator, but wraps the item in a change where reason is ChangeReason.Add

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param item The item.
// * @param key The key.

// */public static IObservable<IChangeSet<TObject, TKey>> StartWithItem<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// TObject item, TKey key)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// var change = new Change<TObject, TKey>(ChangeReason.Add, key, item);
// return source.StartWith(new ChangeSet<TObject, TKey>{change});
// }

// #endregion

// #region  Transform

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param transformOnRefresh Should a new transform be applied when a refresh event is received
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, TDestination> transformFactory,
// bool transformOnRefresh)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// return source.Transform((current, previous, key) => transformFactory(current), transformOnRefresh);
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param transformOnRefresh Should a new transform be applied when a refresh event is received
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, TKey, TDestination> transformFactory,
// bool transformOnRefresh)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// return source.Transform((current, previous, key) => transformFactory(current, key), transformOnRefresh);
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param transformOnRefresh Should a new transform be applied when a refresh event is received
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, Optional<TSource>, TKey, TDestination> transformFactory,
// bool transformOnRefresh)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// return new Transform<TDestination, TSource, TKey>(source, transformFactory, transformOnRefresh: transformOnRefresh).Run();
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, TDestination> transformFactory, IObservable<Func<TSource, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// return source.Transform((current, previous, key) => transformFactory(current), forceTransform.ForForced<TSource, TKey>());
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, TKey, TDestination> transformFactory, IObservable<Func<TSource, TKey, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// return source.Transform((current, previous, key) => transformFactory(current, key), forceTransform);
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, Optional<TSource>, TKey, TDestination> transformFactory, IObservable<Func<TSource, TKey, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (forceTransform!=null)
// {
// return new TransformWithForcedTransform<TDestination, TSource, TKey>(source, transformFactory, forceTransform).Run();
// }

// return new Transform<TDestination, TSource, TKey>(source, transformFactory).Run();
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for all items
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, TDestination> transformFactory, IObservable<Unit> forceTransform)
// {
// return source.Transform((cur, prev, key) => transformFactory(cur), forceTransform.ForForced<TSource, TKey>());
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for all items#
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, TKey, TDestination> transformFactory, IObservable<Unit> forceTransform)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (forceTransform == null)
// {
// throw new ArgumentNullException(nameof(forceTransform));
// }

// return source.Transform((cur, prev, key) => transformFactory(cur, key), forceTransform.ForForced<TSource, TKey>());
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for all items#
// */public static IObservable<IChangeSet<TDestination, TKey>> Transform<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, Optional<TSource>, TKey, TDestination> transformFactory, IObservable<Unit> forceTransform)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (forceTransform == null)
// {
// throw new ArgumentNullException(nameof(forceTransform));
// }

// return source.Transform(transformFactory, forceTransform.ForForced<TSource, TKey>());
// }

// private static IObservable<Func<TSource, TKey, bool>> ForForced<TSource, TKey>(this IObservable<Unit> source)
// {
// return source?.Select(_ =>
// {
// bool Transformer(TSource item, TKey key) => true;
// return (Func<TSource, TKey, bool>) Transformer;
// });
// }

// private static IObservable<Func<TSource, TKey, bool>> ForForced<TSource, TKey>(this IObservable<Func<TSource, bool>> source)
// {
// return source?.Select(condition =>
// {
// bool Transformer(TSource item, TKey key) => condition(item);
// return (Func<TSource, TKey, bool>) Transformer;
// });
// }

// #endregion

// #region Transform Async

// #region Transform many

// #endregion

// #region Transform safe

// /**
//  * Transforms the object to a fully recursive tree, create a hiearchy based on the pivot function

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param pivotOn The pivot on.
// * @param predicateChanged Observable to change the underlying predicate.

// */public static IObservable<IChangeSet<Node<TObject, TKey>, TKey>> TransformToTree<TObject, TKey>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source,
// [NotNull] Func<TObject, TKey> pivotOn,
// IObservable<Func<Node<TObject, TKey>, bool>> predicateChanged = null)
// where TObject : class
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (pivotOn == null)
// {
// throw new ArgumentNullException(nameof(pivotOn));
// }

// return new TreeBuilder<TObject, TKey>(source, pivotOn, predicateChanged).Run();
// }

// #endregion

// #region Distinct values

// /**
//  *     Selects distinct values from the source.

// * @typeparam TObject The tyoe object from which the distinct values are selected
// * @typeparam TKey The type of the key.
// * @typeparam TValue The type of the value.
// * @param source The soure.
// * @param valueSelector The value selector.
// */public static IObservable<IDistinctChangeSet<TValue>> DistinctValues<TObject, TKey, TValue>(this IObservable<IChangeSet<TObject, TKey>> source, Func<TObject, TValue> valueSelector)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (valueSelector == null)
// {
// throw new ArgumentNullException(nameof(valueSelector));
// }

// return Observable.Create<IDistinctChangeSet<TValue>>(observer =>
// {
// return new DistinctCalculator<TObject, TKey, TValue>(source, valueSelector).Run().SubscribeSafe(observer);
// });
// }

// #endregion

// #region   Grouping

// /**
//  *  Groups the source on the value returned by group selector factory.
//  *  A group is included for each item in the resulting group source.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TGroupKey The type of the group key.
// * @param groupSelector The group selector factory.
//  * <param name="resultGroupSource">
//  *   A distinct stream used to determine the result
//  * </param>
//  * <remarks>
//  * Useful for parent-child collection when the parent and child are soured from different streams
//  * </remarks>

// */public static IObservable<IGroupChangeSet<TObject, TKey, TGroupKey>> Group<TObject, TKey, TGroupKey>(
// this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TGroupKey> groupSelector,
// IObservable<IDistinctChangeSet<TGroupKey>> resultGroupSource)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (groupSelector == null)
// {
// throw new ArgumentNullException(nameof(groupSelector));
// }

// if (resultGroupSource == null)
// {
// throw new ArgumentNullException(nameof(resultGroupSource));
// }

// return new SpecifiedGrouper<TObject, TKey, TGroupKey>(source, groupSelector, resultGroupSource).Run();
// }

// /**
//  *  Groups the source on the value returned by group selector factory.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TGroupKey The type of the group key.
// * @param groupSelectorKey The group selector key.

// */public static IObservable<IGroupChangeSet<TObject, TKey, TGroupKey>> Group<TObject, TKey, TGroupKey>(this IObservable<IChangeSet<TObject, TKey>> source, Func<TObject, TGroupKey> groupSelectorKey)

// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (groupSelectorKey == null)
// {
// throw new ArgumentNullException(nameof(groupSelectorKey));
// }

// return new GroupOn<TObject, TKey, TGroupKey>(source, groupSelectorKey, null).Run();
// }

// /**
//  *  Groups the source on the value returned by group selector factory.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TGroupKey The type of the group key.
// * @param groupSelectorKey The group selector key.
// * @param regrouper Invoke to  the for the grouping to be re-evaluated
// */public static IObservable<IGroupChangeSet<TObject, TKey, TGroupKey>> Group<TObject, TKey, TGroupKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TGroupKey> groupSelectorKey,
// IObservable<Unit> regrouper)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (groupSelectorKey == null)
// {
// throw new ArgumentNullException(nameof(groupSelectorKey));
// }

// if (regrouper == null)
// {
// throw new ArgumentNullException(nameof(regrouper));
// }

// return new GroupOn<TObject, TKey, TGroupKey>(source, groupSelectorKey, regrouper).Run();
// }

// /**
//  *  Groups the source on the value returned by group selector factory. Each update produces immuatable grouping.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TGroupKey The type of the group key.
// * @param groupSelectorKey The group selector key.
// * @param regrouper Invoke to  the for the grouping to be re-evaluated
// */public static IObservable<IImmutableGroupChangeSet<TObject, TKey, TGroupKey>> GroupWithImmutableState<TObject, TKey, TGroupKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TGroupKey> groupSelectorKey,
// IObservable<Unit> regrouper = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (groupSelectorKey == null)
// {
// throw new ArgumentNullException(nameof(groupSelectorKey));
// }

// return new GroupOnImmutable<TObject, TKey, TGroupKey>(source, groupSelectorKey, regrouper).Run();
// }

// /**
//  * Groups the source using the property specified by the property selector. Groups are re-applied when the property value changed.
// ///
//  * When there are likely to be a large number of group property changes specify a throttle to improve performance

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TGroupKey The type of the group key.
// * @param propertySelector The property selector used to group the items
// * @param propertyChangedThrottle
// * @param scheduler The scheduler.
// */public static IObservable<IGroupChangeSet<TObject, TKey, TGroupKey>> GroupOnProperty<TObject, TKey, TGroupKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Expression<Func<TObject, TGroupKey>> propertySelector,
// TimeSpan? propertyChangedThrottle = null,
// IScheduler scheduler = null)
// where TObject : INotifyPropertyChanged
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (propertySelector == null)
// {
// throw new ArgumentNullException(nameof(propertySelector));
// }

// return new GroupOnProperty<TObject, TKey, TGroupKey>(source, propertySelector, propertyChangedThrottle, scheduler).Run();
// }

// /**
//  * Groups the source using the property specified by the property selector. Each update produces immuatable grouping. Groups are re-applied when the property value changed.
// ///
//  * When there are likely to be a large number of group property changes specify a throttle to improve performance

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TGroupKey The type of the group key.
// * @param propertySelector The property selector used to group the items
// * @param propertyChangedThrottle
// * @param scheduler The scheduler.
// */public static IObservable<IImmutableGroupChangeSet<TObject, TKey, TGroupKey>> GroupOnPropertyWithImmutableState<TObject, TKey, TGroupKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Expression<Func<TObject, TGroupKey>> propertySelector,
// TimeSpan? propertyChangedThrottle = null,
// IScheduler scheduler = null)
// where TObject : INotifyPropertyChanged
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (propertySelector == null)
// {
// throw new ArgumentNullException(nameof(propertySelector));
// }

// return new GroupOnPropertyWithImmutableState<TObject, TKey, TGroupKey>(source, propertySelector, propertyChangedThrottle, scheduler).Run();
// }

// #endregion

// #region Virtualisation

// /**
//  * Limits the size of the result set to the specified number

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param size The size.
// */public static IObservable<IVirtualChangeSet<TObject, TKey>> Top<TObject, TKey>(
// this IObservable<ISortedChangeSet<TObject, TKey>> source, int size)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (size <= 0)
// {
// throw new ArgumentOutOfRangeException(nameof(size), "Size should be greater than zero");
// }

// return new Virtualise<TObject, TKey>(source, Observable.Return(new VirtualRequest(0, size))).Run();
// }

// /**
//  * Limits the size of the result set to the specified number, ordering by the comparer

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param comparer The comparer.
// * @param size The size.
// */public static IObservable<IVirtualChangeSet<TObject, TKey>> Top<TObject, TKey>(
// this IObservable<IChangeSet<TObject, TKey>> source,
// IComparer<TObject> comparer,
// int size)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (comparer == null)
// {
// throw new ArgumentNullException(nameof(comparer));
// }

// if (size <= 0)
// {
// throw new ArgumentOutOfRangeException(nameof(size), "Size should be greater than zero");
// }

// return source.Sort(comparer).Top(size);
// }

// /**
//  * Virtualises the underlying data from the specified source.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param virtualRequests The virirtualising requests
// */public static IObservable<IVirtualChangeSet<TObject, TKey>> Virtualise<TObject, TKey>(this IObservable<ISortedChangeSet<TObject, TKey>> source,
// IObservable<IVirtualRequest> virtualRequests)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (virtualRequests == null)
// {
// throw new ArgumentNullException(nameof(virtualRequests));
// }

// return new Virtualise<TObject, TKey>(source, virtualRequests).Run();
// }

// #endregion

// #region Binding

// /**
//  *  Binds the results to the specified observable collection collection using the default update algorithm

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param destination The destination.
// */public static IObservable<IChangeSet<TObject, TKey>> Bind<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservableCollection<TObject> destination)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (destination == null)
// {
// throw new ArgumentNullException(nameof(destination));
// }

// var updater = new ObservableCollectionAdaptor<TObject, TKey>();
// return source.Bind(destination, updater);
// }

// /**
//  * Binds the results to the specified binding collection using the specified update algorithm

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param destination The destination.
// * @param updater The updater.
// */public static IObservable<IChangeSet<TObject, TKey>> Bind<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservableCollection<TObject> destination,
// IObservableCollectionAdaptor<TObject, TKey> updater)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (destination == null)
// {
// throw new ArgumentNullException(nameof(destination));
// }

// if (updater == null)
// {
// throw new ArgumentNullException(nameof(updater));
// }

// return Observable.Create<IChangeSet<TObject, TKey>>(observer =>
// {
// var locker = new object();
// return source
// .Synchronize(locker)
// .Select(changes =>
// {
// updater.Adapt(changes, destination);
// return changes;
// }).SubscribeSafe(observer);
// });
// }

// /**
//  *  Binds the results to the specified observable collection collection using the default update algorithm

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param destination The destination.
// */public static IObservable<ISortedChangeSet<TObject, TKey>> Bind<TObject, TKey>(this IObservable<ISortedChangeSet<TObject, TKey>> source,
// IObservableCollection<TObject> destination)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (destination == null)
// {
// throw new ArgumentNullException(nameof(destination));
// }

// var updater = new SortedObservableCollectionAdaptor<TObject, TKey>();
// return source.Bind(destination, updater);
// }

// /**
//  * Binds the results to the specified binding collection using the specified update algorithm

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param destination The destination.
// * @param updater The updater.
// */public static IObservable<ISortedChangeSet<TObject, TKey>> Bind<TObject, TKey>(
// this IObservable<ISortedChangeSet<TObject, TKey>> source,
// IObservableCollection<TObject> destination,
// ISortedObservableCollectionAdaptor<TObject, TKey> updater)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (destination == null)
// {
// throw new ArgumentNullException(nameof(destination));
// }

// if (updater == null)
// {
// throw new ArgumentNullException(nameof(updater));
// }

// return Observable.Create<ISortedChangeSet<TObject, TKey>>(observer =>
// {
// var locker = new object();
// return source
// .Synchronize(locker)
// .Select(changes =>
// {
// updater.Adapt(changes, destination);
// return changes;
// }).SubscribeSafe(observer);
// });
// }

// /**
//  * Binds the results to the specified readonly observable collection collection using the default update algorithm

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param readOnlyObservableCollection The resulting read only observable collection.
// * @param resetThreshold The number of changes before a reset event is called on the observable collection
// * @param adaptor Specify an adaptor to change the algorithm to update the target collection
// */public static IObservable<IChangeSet<TObject, TKey>> Bind<TObject, TKey>(this IObservable<ISortedChangeSet<TObject, TKey>> source,
// out ReadOnlyObservableCollection<TObject> readOnlyObservableCollection,
// int resetThreshold = 25,
// ISortedObservableCollectionAdaptor<TObject, TKey> adaptor = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// var target = new ObservableCollectionExtended<TObject>();
// var result = new ReadOnlyObservableCollection<TObject>(target);
// var updater = adaptor ?? new SortedObservableCollectionAdaptor<TObject, TKey>(resetThreshold);
// readOnlyObservableCollection = result;
// return source.Bind(target, updater);
// }

// /**
//  * Binds the results to the specified readonly observable collection collection using the default update algorithm

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param readOnlyObservableCollection The resulting read only observable collection.
// * @param resetThreshold The number of changes before a reset event is called on the observable collection
// * @param adaptor Specify an adaptor to change the algorithm to update the target collection
// */public static IObservable<IChangeSet<TObject, TKey>> Bind<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// out ReadOnlyObservableCollection<TObject> readOnlyObservableCollection,
// int resetThreshold = 25,
// IObservableCollectionAdaptor<TObject, TKey> adaptor = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// var target = new ObservableCollectionExtended<TObject>();
// var result = new ReadOnlyObservableCollection<TObject>(target);
// var updater = adaptor ?? new ObservableCollectionAdaptor<TObject, TKey>(resetThreshold);
// readOnlyObservableCollection = result;
// return source.Bind(target, updater);
// }

// #if SUPPORTS_BINDINGLIST

// /**
//  * Binds a clone of the observable changeset to the target observable collection

// * @typeparam TObject The object type
// * @typeparam TKey The key type
// * @param bindingList The target binding list
// * @param resetThreshold The reset threshold.
// */public static IObservable<IChangeSet<TObject, TKey>> Bind<TObject, TKey>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source,
// [NotNull] BindingList<TObject> bindingList, int resetThreshold = 25)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (bindingList == null)
// {
// throw new ArgumentNullException(nameof(bindingList));
// }

// return source.Adapt(new BindingListAdaptor<TObject, TKey>(bindingList, resetThreshold));
// }

// /**
//  * Binds a clone of the observable changeset to the target observable collection

// * @typeparam TObject The object type
// * @typeparam TKey The key type
// * @param bindingList The target binding list
// * @param resetThreshold The reset threshold.
// */public static IObservable<IChangeSet<TObject, TKey>> Bind<TObject, TKey>([NotNull] this IObservable<ISortedChangeSet<TObject, TKey>> source,
// [NotNull] BindingList<TObject> bindingList, int resetThreshold = 25)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (bindingList == null)
// {
// throw new ArgumentNullException(nameof(bindingList));
// }

// return source.Adapt(new SortedBindingListAdaptor<TObject, TKey>(bindingList, resetThreshold));
// }

// #endif

// #endregion

// #region Adaptor

// /**
//  * Inject side effects into the stream using the specified adaptor

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param adaptor The adaptor.
// */public static IObservable<IChangeSet<TObject, TKey>> Adapt<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, IChangeSetAdaptor<TObject, TKey> adaptor)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (adaptor == null)
// {
// throw new ArgumentNullException(nameof(adaptor));
// }

// return source.Do(adaptor.Adapt);
// }

// /**
//  * Inject side effects into the stream using the specified sorted adaptor

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param adaptor The adaptor.
// */public static IObservable<IChangeSet<TObject, TKey>> Adapt<TObject, TKey>(this IObservable<ISortedChangeSet<TObject, TKey>> source, ISortedChangeSetAdaptor<TObject, TKey> adaptor)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (adaptor == null)
// {
// throw new ArgumentNullException(nameof(adaptor));
// }

// return source.Do(adaptor.Adapt);
// }

// #endregion

// #region Joins
// /**
//  * Joins the left and right observable data sources, taking values when both left and right values are present
//  * This is the equivalent of SQL inner join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> InnerJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<TLeft, TRight, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return left.InnerJoin(right, rightKeySelector, (leftKey, leftValue, rightValue) => resultSelector(leftValue, rightValue));
// }

// /**
//  *  Groups the right data source and joins the to the left and the right sources, taking values when both left and right values are present
//  * This is the equivalent of SQL inner join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> InnerJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<TLeftKey, TLeft, TRight, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return new InnerJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(left, right, rightKeySelector, resultSelector).Run();
// }

// /**
//  * Groups the right data source and joins the resulting group to the left data source, matching these using the specified key selector. Results are included when the left and right have matching values.
//  * This is the equivalent of SQL inner join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> InnerJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<TLeft, IGrouping<TRight, TRightKey, TLeftKey>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return left.InnerJoinMany(right, rightKeySelector, (leftKey, leftValue, rightValue) => resultSelector(leftValue, rightValue));
// }

// /**
//  * Groups the right data source and joins the resulting group to the left data source, matching these using the specified key selector. Results are included when the left and right have matching values.
//  * This is the equivalent of SQL inner join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> InnerJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<TLeftKey, TLeft, IGrouping<TRight, TRightKey, TLeftKey>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return new InnerJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(left, right, rightKeySelector, resultSelector).Run();
// }

// /**
//  * Joins the left and right observable data sources, taking any left or right values and matching them, provided that the left or the right has a value.
//  * This is the equivalent of SQL full join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> FullJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<Optional<TLeft>, Optional<TRight>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return left.FullJoin(right, rightKeySelector, (leftKey, leftValue, rightValue) => resultSelector(leftValue, rightValue));
// }

// /**
//  * Joins the left and right observable data sources, taking any left or right values and matching them, provided that the left or the right has a value.
//  * This is the equivalent of SQL full join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> FullJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<TLeftKey, Optional<TLeft>, Optional<TRight>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return new FullJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(left, right, rightKeySelector, resultSelector).Run();
// }

// /**
//  * Groups the right data source and joins the resulting group to the left data source, matching these using the specified key selector. Results are included when the left or the right has a value.
//  * This is the equivalent of SQL full join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> FullJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull] Func<TRight, TLeftKey> rightKeySelector,
// [NotNull] Func<Optional<TLeft>, IGrouping<TRight, TRightKey, TLeftKey>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return left.FullJoinMany(right, rightKeySelector, (leftKey, leftValue, rightValue) => resultSelector(leftValue, rightValue));
// }

// /**
//  * Groups the right data source and joins the resulting group to the left data source, matching these using the specified key selector. Results are included when the left or the right has a value.
//  * This is the equivalent of SQL full join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> FullJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull] Func<TRight, TLeftKey> rightKeySelector,
// [NotNull] Func<TLeftKey, Optional<TLeft>, IGrouping<TRight, TRightKey, TLeftKey>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return new FullJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(left, right, rightKeySelector, resultSelector).Run();
// }

// /**
//  * Joins the left and right observable data sources, taking all left values and combining any matching right values.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> LeftJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull] Func<TRight, TLeftKey> rightKeySelector,
// [NotNull] Func<TLeft, Optional<TRight>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return left.LeftJoin(right, rightKeySelector, (leftKey, leftValue, rightValue) => resultSelector(leftValue, rightValue));
// }

// /**
//  * Joins the left and right observable data sources, taking all left values and combining any matching right values.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> LeftJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<TLeftKey, TLeft, Optional<TRight>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return new LeftJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(left, right, rightKeySelector, resultSelector).Run();
// }

// /**
//  * Groups the right data source and joins the two sources matching them using the specified key selector, taking all left values and combining any matching right values.
//  * This is the equivalent of SQL left join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> LeftJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull] Func<TRight, TLeftKey> rightKeySelector,
// [NotNull] Func<TLeft, IGrouping<TRight, TRightKey, TLeftKey>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return left.LeftJoinMany(right, rightKeySelector, (leftKey, leftValue, rightValue) => resultSelector(leftValue, rightValue));
// }

// /**
//  * Groups the right data source and joins the two sources matching them using the specified key selector, taking all left values and combining any matching right values.
//  * This is the equivalent of SQL left join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> LeftJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull] Func<TRight, TLeftKey> rightKeySelector,
// [NotNull] Func<TLeftKey, TLeft, IGrouping<TRight, TRightKey, TLeftKey>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return new LeftJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(left, right, rightKeySelector, resultSelector).Run();
// }

// /**
//  * Joins the left and right observable data sources, taking all right values and combining any matching left values.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> RightJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<Optional<TLeft>, TRight, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return left.RightJoin(right, rightKeySelector, (leftKey, leftValue, rightValue) => resultSelector(leftValue, rightValue));
// }

// /**
//  * Joins the left and right observable data sources, taking all right values and combining any matching left values.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> RightJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull]  Func<TRight, TLeftKey> rightKeySelector,
// [NotNull]  Func<TLeftKey, Optional<TLeft>, TRight, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return new RightJoin<TLeft, TLeftKey, TRight, TRightKey, TDestination>(left, right, rightKeySelector, resultSelector).Run();
// }

// /**
//  * Groups the right data source and joins the two sources matching them using the specified key selector, , taking all right values and combining any matching left values.
//  * This is the equivalent of SQL left join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (left, right) =&gt; new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> RightJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull] Func<TRight, TLeftKey> rightKeySelector,
// [NotNull] Func<Optional<TLeft>, IGrouping<TRight, TRightKey, TLeftKey>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return left.RightJoinMany(right, rightKeySelector, (leftKey, leftValue, rightValue) => resultSelector(leftValue, rightValue));
// }

// /**
//  * Groups the right data source and joins the two sources matching them using the specified key selector,, taking all right values and combining any matching left values.
//  * This is the equivalent of SQL left join.

// * @typeparam TLeft The object type of the left datasource
// * @typeparam TLeftKey The key type of the left datasource
// * @typeparam TRight The object type of the right datasource
// * @typeparam TRightKey The key type of the right datasource
// * @typeparam TDestination The resulting object which
// * @param left The left data source
// * @param right The right data source.
// * @param rightKeySelector Specify the foreign key on the right datasource
// * @param resultSelector The result selector.used to transform the combined data into. Example (key, left, right) => new CustomObject(key, left, right)
// */public static IObservable<IChangeSet<TDestination, TLeftKey>> RightJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(this IObservable<IChangeSet<TLeft, TLeftKey>> left,
// [NotNull] IObservable<IChangeSet<TRight, TRightKey>> right,
// [NotNull] Func<TRight, TLeftKey> rightKeySelector,
// [NotNull] Func<TLeftKey, Optional<TLeft>, IGrouping<TRight, TRightKey, TLeftKey>, TDestination> resultSelector)
// {
// if (left == null)
// {
// throw new ArgumentNullException(nameof(left));
// }

// if (right == null)
// {
// throw new ArgumentNullException(nameof(right));
// }

// if (rightKeySelector == null)
// {
// throw new ArgumentNullException(nameof(rightKeySelector));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return new RightJoinMany<TLeft, TLeftKey, TRight, TRightKey, TDestination>(left, right, rightKeySelector, resultSelector).Run();
// }

// #endregion

// #region Populate into an observable cache

// /**
//  * Populates a source into the specified cache.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param detination The detination.
// */public static IDisposable PopulateInto<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, ISourceCache<TObject, TKey> detination)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (detination == null)
// {
// throw new ArgumentNullException(nameof(detination));
// }

// return source.Subscribe(changes => detination.Edit(updater => updater.Clone(changes)));
// }

// /**
//  * Populates a source into the specified cache

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param detination The detination.
// */public static IDisposable PopulateInto<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, IIntermediateCache<TObject, TKey> detination)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (detination == null)
// {
// throw new ArgumentNullException(nameof(detination));
// }

// return source.Subscribe(changes => detination.Edit(updater => updater.Clone(changes)));
// }

// /**
//  * Populate a cache from an observable stream.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param observable The observable.
// */public static IDisposable PopulateFrom<TObject, TKey>(this ISourceCache<TObject, TKey> source, IObservable<IEnumerable<TObject>> observable)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return observable.Subscribe(source.AddOrUpdate);
// }

// /**
//  * Populate a cache from an observable stream.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param observable The observable.
// */public static IDisposable PopulateFrom<TObject, TKey>(this ISourceCache<TObject, TKey> source, IObservable<TObject> observable)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return observable.Subscribe(source.AddOrUpdate);
// }

// #endregion

// #region AsObservableCache / Connect

// /**
//  * Converts the source to an read only observable cache

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// */public static IObservableCache<TObject, TKey> AsObservableCache<TObject, TKey>(this IObservableCache<TObject, TKey> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return new AnonymousObservableCache<TObject, TKey>(source);
// }

// /**
//  * Converts the source to a readonly observable cache

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param applyLocking if set to <c>true</c> all methods are synchronised. There is no need to apply locking when the consumer can be sure the the read / write operations are already synchronised
// */public static IObservableCache<TObject, TKey> AsObservableCache<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, bool applyLocking = true)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (applyLocking)
// {
// return new AnonymousObservableCache<TObject, TKey>(source);
// }

// return new LockFreeObservableCache<TObject, TKey>(source);
// }

// #endregion

// #region Populate changetset from observables

// /**
//  * Converts the observable to an observable changeset.
//  * Change set observes observable change events.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param keySelector The key selector.
// * @param expireAfter Specify on a per object level the maximum time before an object expires from a cache
// * @param limitSizeTo Remove the oldest items when the size has reached this limit
// * @param scheduler The scheduler (only used for time expiry).
// */public static IObservable<IChangeSet<TObject, TKey>> ToObservableChangeSet<TObject, TKey>(
// this IObservable<TObject> source,
// Func<TObject, TKey> keySelector,
// Func<TObject, TimeSpan?> expireAfter = null,
// int limitSizeTo = -1,
// IScheduler scheduler = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (keySelector == null)
// {
// throw new ArgumentNullException(nameof(keySelector));
// }

// return new ToObservableChangeSet<TObject, TKey>(source, keySelector, expireAfter, limitSizeTo, scheduler).Run();
// }

// /**
//  * Converts the observable to an observable changeset.
//  * Change set observes observable change events.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param keySelector The key selector.
// * @param expireAfter Specify on a per object level the maximum time before an object expires from a cache
// * @param limitSizeTo Remove the oldest items when the size has reached this limit
// * @param scheduler The scheduler (only used for time expiry).
// */public static IObservable<IChangeSet<TObject, TKey>> ToObservableChangeSet<TObject, TKey>(this IObservable<IEnumerable<TObject>> source, Func<TObject, TKey> keySelector,
// Func<TObject, TimeSpan?> expireAfter = null,
// int limitSizeTo = -1,
// IScheduler scheduler = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (keySelector == null)
// {
// throw new ArgumentNullException(nameof(keySelector));
// }

// return new ToObservableChangeSet<TObject, TKey>(source, keySelector, expireAfter, limitSizeTo, scheduler).Run();
// }

// #endregion

// #region Size / time limiters

// /**
//  * Limits the number of records in the cache to the size specified.  When the size is reached
//  * the oldest items are removed from the cache

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sizeLimit The size limit.
// * @param scheduler The scheduler.
// */public static IObservable<IEnumerable<KeyValuePair<TKey, TObject>>> LimitSizeTo<TObject, TKey>(this ISourceCache<TObject, TKey> source, int sizeLimit, IScheduler scheduler = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (sizeLimit <= 0)
// {
// throw new ArgumentException("Size limit must be greater than zero", nameof(sizeLimit));
// }

// return Observable.Create<IEnumerable<KeyValuePair<TKey, TObject>>>(observer =>
// {
// long orderItemWasAdded = -1;
// var sizeLimiter = new SizeLimiter<TObject, TKey>(sizeLimit);

// return source.Connect()
// .Finally(observer.OnCompleted)
// .ObserveOn(scheduler ?? Scheduler.Default)
// .Transform((t, v) => new ExpirableItem<TObject, TKey>(t, v, DateTime.Now, Interlocked.Increment(ref orderItemWasAdded)))
// .Select(sizeLimiter.CloneAndReturnExpiredOnly)
// .Where(expired => expired.Length != 0)
// .Subscribe(source.Remove);
// });
// }

// /**
//  * Automatically removes items from the cache after the time specified by
//  * the time selector elapses.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param source The cache.
// * @param timeSelector The time selector.  Return null if the item should never be removed
// * @param scheduler The scheduler to perform the work on.
// */public static IObservable<IEnumerable<KeyValuePair<TKey, TObject>>> ExpireAfter<TObject, TKey>(this ISourceCache<TObject, TKey> source,
// Func<TObject, TimeSpan?> timeSelector, IScheduler scheduler = null)
// {
// return source.ExpireAfter(timeSelector, null, scheduler);
// }

// /**
//  * Automatically removes items from the cache after the time specified by
//  * the time selector elapses.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param source The cache.
// * @param timeSelector The time selector.  Return null if the item should never be removed
// * @param interval A polling interval.  Since multiple timer subscriptions can be expensive, it may be worth setting the interval .
// */public static IObservable<IEnumerable<KeyValuePair<TKey, TObject>>> ExpireAfter<TObject, TKey>(this ISourceCache<TObject, TKey> source,
// Func<TObject, TimeSpan?> timeSelector, TimeSpan? interval = null)
// {
// return ExpireAfter(source, timeSelector, interval, Scheduler.Default);
// }

// /**
//  * Automatically removes items from the cache after the time specified by
//  * the time selector elapses.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param source The cache.
// * @param timeSelector The time selector.  Return null if the item should never be removed
// * @param pollingInterval A polling interval.  Since multiple timer subscriptions can be expensive, it may be worth setting the interval .
// * @param scheduler The scheduler.
// */public static IObservable<IEnumerable<KeyValuePair<TKey, TObject>>> ExpireAfter<TObject, TKey>(this ISourceCache<TObject, TKey> source,
// Func<TObject, TimeSpan?> timeSelector, TimeSpan? pollingInterval, IScheduler scheduler)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (timeSelector == null)
// {
// throw new ArgumentNullException(nameof(timeSelector));
// }

// return Observable.Create<IEnumerable<KeyValuePair<TKey, TObject>>>(observer =>
// {
// scheduler = scheduler ?? Scheduler.Default;
// return source.Connect()
// .ForExpiry(timeSelector, pollingInterval, scheduler)
// .Finally(observer.OnCompleted)
// .Subscribe(toRemove =>
// {
// try
// {
// //remove from cache and notify which items have been auto removed
// var keyValuePairs = toRemove as KeyValuePair<TKey, TObject>[] ?? toRemove.AsArray();
// if (keyValuePairs.Length == 0)
// {
// return;
// }

// source.Remove(keyValuePairs.Select(kv => kv.Key));
// observer.OnNext(keyValuePairs);
// }
// catch (Exception ex)
// {
// observer.OnError(ex);
// }
// });
// });
// }

// #endregion

// #region Convenience update methods

// /**
//  * Loads the cache with the specified items in an optimised manner i.e. calculates the differences between the old and new items
//  *  in the list and amends only the differences

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param alltems
// * @param equalityComparer The equality comparer used to determine whether a new item is the same as an existing cached item
// */public static void EditDiff<TObject, TKey>([NotNull] this ISourceCache<TObject, TKey> source,
// [NotNull] IEnumerable<TObject> alltems,
// [NotNull] IEqualityComparer<TObject> equalityComparer)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (alltems == null)
// {
// throw new ArgumentNullException(nameof(alltems));
// }

// if (equalityComparer == null)
// {
// throw new ArgumentNullException(nameof(equalityComparer));
// }

// source.EditDiff(alltems, equalityComparer.Equals);
// }

// /**
//  * Loads the cache with the specified items in an optimised manner i.e. calculates the differences between the old and new items
//  *  in the list and amends only the differences

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param alltems
// * @param areItemsEqual Expression to determine whether an item's value is equal to the old value (current, previous) => current.Version == previous.Version
// */public static void EditDiff<TObject, TKey>([NotNull] this ISourceCache<TObject, TKey> source,
// [NotNull] IEnumerable<TObject> alltems,
// [NotNull] Func<TObject, TObject, bool> areItemsEqual)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (alltems == null)
// {
// throw new ArgumentNullException(nameof(alltems));
// }

// if (areItemsEqual == null)
// {
// throw new ArgumentNullException(nameof(areItemsEqual));
// }

// var editDiff = new EditDiff<TObject, TKey>(source, areItemsEqual);
// editDiff.Edit(alltems);
// }

// /**
//  * Adds or updates the cache with the specified item.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param item The item.
// */public static void AddOrUpdate<TObject, TKey>(this ISourceCache<TObject, TKey> source, TObject item)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.AddOrUpdate(item));
// }

// /**
//  * Adds or updates the cache with the specified item.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param item The item.
// * @param equalityComparer The equality comparer used to determine whether a new item is the same as an existing cached item
// */public static void AddOrUpdate<TObject, TKey>(this ISourceCache<TObject, TKey> source, TObject item, IEqualityComparer<TObject> equalityComparer)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.AddOrUpdate(item, equalityComparer));
// }

// /**
//  * <summary>
//  * Adds or updates the cache with the specified items.

//  * </summary>
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param items The items.
// */public static void AddOrUpdate<TObject, TKey>(this ISourceCache<TObject, TKey> source, IEnumerable<TObject> items)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.AddOrUpdate(items));
// }

// /**
//  * Removes the specified item from the cache.
// ///
//  * If the item is not contained in the cache then the operation does nothing.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param item The item.
// */public static void Remove<TObject, TKey>(this ISourceCache<TObject, TKey> source, TObject item)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Remove(item));
// }

// /**
//  * Removes the specified key from the cache.
//  * If the item is not contained in the cache then the operation does nothing.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param key The key.
// */public static void Remove<TObject, TKey>(this ISourceCache<TObject, TKey> source, TKey key)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Remove(key));
// }

// /**
//  * Removes the specified key from the cache.
//  * If the item is not contained in the cache then the operation does nothing.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param key The key.
// */public static void RemoveKey<TObject, TKey>(this ISourceCache<TObject, TKey> source, TKey key)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.RemoveKey(key));
// }

// /**
//  * Removes the specified items from the cache.
// ///
//  * Any items not contained in the cache are ignored

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param items The items.
// */public static void Remove<TObject, TKey>(this ISourceCache<TObject, TKey> source, IEnumerable<TObject> items)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Remove(items));
// }

// /**
//  * Removes the specified keys from the cache.
// ///
//  * Any keys not contained in the cache are ignored

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param keys The keys.
// */public static void Remove<TObject, TKey>(this ISourceCache<TObject, TKey> source, IEnumerable<TKey> keys)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Remove(keys));
// }

// /**
//  * Removes the specified keys from the cache.
// ///
//  * Any keys not contained in the cache are ignored

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param keys The keys.
// */public static void RemoveKeys<TObject, TKey>(this ISourceCache<TObject, TKey> source, IEnumerable<TKey> keys)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.RemoveKeys(keys));
// }

// /**
//  * Clears all data

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// */public static void Clear<TObject, TKey>(this ISourceCache<TObject, TKey> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Clear());
// }

// /**
//  * Signal observers to re-evaluate the specified item.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param item The item.
// */public static void Refresh<TObject, TKey>(this ISourceCache<TObject, TKey> source, TObject item)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Refresh(item));
// }

// /**
//  * Signal observers to re-evaluate the specified items.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param items The items.
// */public static void Refresh<TObject, TKey>(this ISourceCache<TObject, TKey> source, IEnumerable<TObject> items)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Refresh(items));
// }

// /**
//  * Signal observers to re-evaluate the all items.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// */public static void Refresh<TObject, TKey>(this ISourceCache<TObject, TKey> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Refresh());
// }

// /**
//  * Removes the specified key from the cache.
//  * If the item is not contained in the cache then the operation does nothing.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param item
// * @param key The key.
// */public static void AddOrUpdate<TObject, TKey>(this IIntermediateCache<TObject, TKey> source, TObject item, TKey key)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (item == null)
// {
// throw new ArgumentNullException(nameof(item));
// }

// source.Edit(updater => updater.AddOrUpdate(item, key));
// }

// /**
//  * Removes the specified key from the cache.
//  * If the item is not contained in the cache then the operation does nothing.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param key The key.
// */public static void Remove<TObject, TKey>(this IIntermediateCache<TObject, TKey> source, TKey key)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Remove(key));
// }

// /**
//  * Removes the specified keys from the cache.
// ///
//  * Any keys not contained in the cache are ignored

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param keys The keys.
// */public static void Remove<TObject, TKey>(this IIntermediateCache<TObject, TKey> source, IEnumerable<TKey> keys)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Remove(keys));
// }

// /**
//  * Clears all items from the cache

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// */public static void Clear<TObject, TKey>(this IIntermediateCache<TObject, TKey> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Clear());
// }

// /**
//  * Clears all data

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// */public static void Clear<TObject, TKey>(this LockFreeObservableCache<TObject, TKey> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// source.Edit(updater => updater.Clear());
// }

// /**
//  * Populates a source into the specified cache.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param detination The detination.
// */public static IDisposable PopulateInto<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, LockFreeObservableCache<TObject, TKey> detination)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (detination == null)
// {
// throw new ArgumentNullException(nameof(detination));
// }

// return source.Subscribe(changes => detination.Edit(updater => updater.Clone(changes)));
// }

// #endregion

// #region Switch

// /**
//  * Transforms an observable sequence of observable caches into a single sequence
//  * producing values only from the most recent observable sequence.
//  * Each time a new inner observable sequence is received, unsubscribe from the
//  * previous inner observable sequence and clear the existing result set

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.
// */public static IObservable<IChangeSet<TObject, TKey>> Switch<TObject, TKey>(this IObservable<IObservableCache<TObject, TKey>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return sources.Select(cache => cache.Connect()).Switch();
// }

// /**
//  * Transforms an observable sequence of observable changes sets into an observable sequence
//  * producing values only from the most recent observable sequence.
//  * Each time a new inner observable sequence is received, unsubscribe from the
//  * previous inner observable sequence and clear the existing resukt set

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param sources The source.

// */public static IObservable<IChangeSet<TObject, TKey>> Switch<TObject, TKey>(this IObservable<IObservable<IChangeSet<TObject, TKey>>> sources)
// {
// if (sources == null)
// {
// throw new ArgumentNullException(nameof(sources));
// }

// return new Switch<TObject, TKey>(sources).Run();

// }

// #endregion
// */
