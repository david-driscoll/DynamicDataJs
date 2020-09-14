import { interval, Observable, OperatorFunction, queueScheduler, SchedulerLike, timer } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { asObservableCache } from './asObservableCache';
import { take, tap } from 'rxjs/operators';
import { transform } from './transform';
import { ExpirableItem } from '../ExpirableItem';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { filter as ixFilter, map as ixMap } from 'ix/iterable/operators';
import { Disposable, SingleAssignmentDisposable } from '../../util';
import { distinctValues } from './distinctValues';
import { subscribeMany } from './subscribeMany';

/**
 * Automatically removes items from the stream after the time specified by
 * the timeSelector elapses.  Return null if the item should never be removed
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param timeSelector The time selector.
 * @param timerInterval The time interval.
 * @param scheduler The scheduler.
 */
export function forExpiry<TObject, TKey>(
    timeSelector: (value: TObject) => number | undefined,
    timerInterval?: number | undefined,
    scheduler: SchedulerLike = queueScheduler,
): OperatorFunction<IChangeSet<TObject, TKey>, Iterable<readonly [TKey, TObject]>> {
    return function forExpiryOperator(source) {
        return new Observable<Iterable<readonly [TKey, TObject]>>(observer => {
            const autoRemover = asObservableCache(
                source.pipe(
                    transform((value, key, previous) => {
                        const removeAt = timeSelector(value);
                        const expireAt = removeAt ? scheduler.now() + removeAt : undefined;
                        return <ExpirableItem<TObject, TKey>>{ expireAt, key, value };
                    }),
                ),
            );

            function removalAction() {
                try {
                    const toRemove = ixFrom(autoRemover.values()).pipe(
                        ixFilter(x => x.expireAt !== undefined && x.expireAt <= scheduler.now()),
                        ixMap(x => [x.key, x.value] as const),
                    );

                    observer.next(toRemove);
                } catch (error) {
                    observer.error(error);
                }
            }

            const removalSubscription = new SingleAssignmentDisposable();
            if (timerInterval) {
                // use polling
                removalSubscription.disposable = interval(timerInterval, scheduler).subscribe(removalAction);
            } else {
                //create a timer for each distinct time
                removalSubscription.disposable = autoRemover
                    .connect()
                    .pipe(
                        distinctValues(ei => ei.expireAt),
                        subscribeMany(datetime => {
                            const expireAt = datetime - scheduler.now();
                            return timer(expireAt, scheduler).pipe(take(1)).subscribe(removalAction);
                        }),
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
