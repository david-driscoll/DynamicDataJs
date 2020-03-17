import { ConnectableObservable, MonoTypeOperatorFunction, Observable, queueScheduler, SchedulerLike } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IntermediateCache } from '../IntermediateCache';
import { finalize, publish } from 'rxjs/operators';
import { forExpiry } from './forExpiry';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { map as ixMap } from 'ix/Ix.dom.iterable.operators';
import { Disposable } from '../../util';

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
    scheduler: SchedulerLike = queueScheduler,
): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function expireAfterOperator(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const cache = new IntermediateCache<TObject, TKey>(source);

            const published: ConnectableObservable<IChangeSet<TObject, TKey>> = source.pipe(publish()) as any;
            const subscriber = published.subscribe(observer);

            const autoRemover = published
                .pipe(
                    forExpiry(timeSelector, interval, scheduler),
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