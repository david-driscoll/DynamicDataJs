import { ConnectableObservable, MonoTypeOperatorFunction, Observable, queueScheduler, SchedulerLike } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IntermediateCache } from '../IntermediateCache';
import { finalize, publish } from 'rxjs/operators';
import { forExpiry } from './forExpiry';
import { from as ixFrom, count } from 'ix/iterable';
import { map as ixMap } from 'ix/iterable/operators';
import { Disposable } from '../../util';
import { NotifyPropertyChanged } from '../../notify/notifyPropertyChangedSymbol';
import { ISourceCache, isSourceCache } from '../ISourceCache';
import { isObservableCache } from '../IObservableCache';
import { isScheduler } from 'rxjs/internal-compatibility';

/**
 * Automatically removes items from the cache after the time specified by
 * the time selector elapses.

 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param cache The cache
 * @param timeSelector The time selector.  Return null if the item should never be removed
 * @param interval The polling interval.  Since multiple timer subscriptions can be expensive, it may be worth setting the interval.
 * @param scheduler The scheduler.
 */
export function expireAfter<TObject, TKey>(
    cache: ISourceCache<TObject, TKey>,
    timeSelector: (value: TObject) => number | undefined,
    interval?: number,
    scheduler?: SchedulerLike
): Observable<Iterable<[TKey, TObject]>>;
/**
 * Automatically removes items from the cache after the time specified by
 * the time selector elapses.

 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param timeSelector The time selector.  Return null if the item should never be removed
 * @param scheduler The scheduler.
 */
export function expireAfter<TObject, TKey>(
    timeSelector: (value: TObject) => number | undefined,
    scheduler?: SchedulerLike
): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>;
/**
 * Automatically removes items from the cache after the time specified by
 * the time selector elapses.

 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param cache The cache
 * @param timeSelector The time selector.  Return null if the item should never be removed
 * @param scheduler The scheduler.
 */
export function expireAfter<TObject, TKey>(
    cache: ISourceCache<TObject, TKey>,
    timeSelector: (value: TObject) => number | undefined,
    scheduler?: SchedulerLike
): Observable<Iterable<[TKey, TObject]>>;
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
    timeSelector: (value: TObject) => number | undefined,
    interval?: number,
    scheduler?: SchedulerLike
): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>;
export function expireAfter<TObject, TKey>(
    cache: ISourceCache<TObject, TKey> | ((value: TObject) => number | undefined),
    timeSelector?: ((value: TObject) => number | undefined) | number | SchedulerLike,
    interval?: number | SchedulerLike,
    scheduler: SchedulerLike = queueScheduler,
): any {
    if (!isSourceCache(cache)) {
        scheduler = interval as any;
        interval = timeSelector as any;
        timeSelector = cache as any;
    }
    if (isScheduler(timeSelector)) {
        scheduler = timeSelector;
        timeSelector = undefined;
        interval = undefined;
    }
    if (isScheduler(interval)) {
        scheduler = interval;
        interval = undefined;
    }
    if (isSourceCache(cache)) {
        return new Observable<Iterable<readonly [TKey, TObject]>>(observer => {
            return cache.connect()
                .pipe(
                    forExpiry(timeSelector as any, interval as any, scheduler),
                    finalize(() => observer.complete())
                )
                .subscribe(toRemove => {
                    try {
                        const keys = ixFrom(toRemove);
                        cache.edit(updater => updater.removeKeys(keys.pipe(ixMap(([key, _]) => key))));
                        observer.next(keys);
                    } catch (error) {
                        observer.error(error);
                    }
                });
        });
    }

    return function expireAfterOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const cache = new IntermediateCache<TObject, TKey>(source);

            const published: ConnectableObservable<IChangeSet<TObject, TKey>> = source.pipe(publish()) as any;
            const subscriber = published.subscribe(observer);

            const autoRemover = published
                .pipe(
                    forExpiry(timeSelector as any, interval as any, scheduler as any),
                    finalize(() => observer.complete()),
                )
                .subscribe(keys => {
                    try {
                        cache.edit(updater => updater.removeKeys(ixFrom(keys).pipe(ixMap(([key, _]) => key))));
                    } catch (error) {
                        observer.error(error);
                    }
                });

            const connected = published.connect();

            return Disposable.create(() => {
                connected.unsubscribe();
                subscriber.unsubscribe();
                autoRemover.unsubscribe();
                cache.dispose();
            });
        });
    };
}