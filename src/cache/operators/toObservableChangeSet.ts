import { ConnectableObservable, merge, NEVER, Observable, queueScheduler, SchedulerLike, timer } from 'rxjs';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';
import { IChangeSet } from '../IChangeSet';
import { map, publish, scan } from 'rxjs/operators';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { ExpirableItem } from '../ExpirableItem';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { map as ixMap } from 'ix/Ix.dom.iterable.operators';
import { orderBy, take } from 'ix/iterable/operators';
import { filter } from './filter';
import { groupOn } from './groupOn';
import { mergeMany } from './mergeMany';
import { transform } from './transform';
import { notEmpty } from './notEmpty';
import { CompositeDisposable } from '../../util';

/**
 * Converts the observable to an observable changeset.
 * Change set observes observable change events.
 * @category Operator
 * @typeparam TObject The type of the object
 * @typeparam The type of the key
 * @param source The source
 * @param keySelector The key selector
 * @param expireAfter Specify on a per object level the maximum time before an object expires from a cache
 * @param limitSizeTo Remove the oldest items when the size has reached this limit
 * @param scheduler The scheduler (only used for time expiry)
 */
export function toObservableChangeSet<TObject, TKey>(
    source: Observable<ArrayOrIterable<TObject>>,
    keySelector: (value: TObject) => TKey,
    expireAfter?: (value: TObject) => number | undefined,
    limitSizeTo: number = -1,
    scheduler: SchedulerLike = queueScheduler,
): Observable<IChangeSet<TObject, TKey>> {
    return new Observable<IChangeSet<TObject, TKey>>(observer => {
        const orderItemWasAdded = -1;

        if (expireAfter == undefined && limitSizeTo < 1) {
            return source
                .pipe(
                    scan((state, latest) => {
                        for (const item of latest) state.addOrUpdate(item, keySelector(item));
                        return state;
                    }, new ChangeAwareCache<TObject, TKey>()),
                    map(state => state.captureChanges()),
                )
                .subscribe(observer);
        }

        const cache = new ChangeAwareCache<ExpirableItem<TObject, TKey>, TKey>();
        const sizeLimited = publish<IChangeSet<ExpirableItem<TObject, TKey>, TKey>>()(
            source.pipe(
                scan((state, latest) => {
                    ixFrom(latest)
                        .pipe(
                            ixMap(t => {
                                const key = keySelector(t);
                                return CreateExpirableItem(t, key, orderItemWasAdded);
                            }),
                        )
                        .forEach(ei => cache.addOrUpdate(ei, ei.key));

                    if (limitSizeTo > 0 && state.size > limitSizeTo) {
                        const toRemove = state.size - limitSizeTo;

                        //remove oldest items
                        ixFrom(cache.entries())
                            .pipe(
                                orderBy(exp => exp[1].index),
                                take(toRemove),
                            )
                            .forEach(ei => cache.removeKey(ei[0]));
                    }
                    return state;
                }, cache),
                map(state => state.captureChanges()),
            ),
        );

        const timeLimited = (expireAfter === undefined ? (NEVER as Observable<IChangeSet<ExpirableItem<TObject, TKey>, TKey>>) : sizeLimited).pipe(
            filter(ei => ei.expireAt !== -1),
            groupOn(ei => ei.expireAt),
            mergeMany(grouping => {
                const expireAt = grouping.key - scheduler.now();
                return timer(expireAt, scheduler).pipe(map(_ => grouping));
            }),
            map(grouping => {
                cache.removeKeys(grouping.cache.keys());
                return cache.captureChanges();
            }),
        );

        const publisher = merge(sizeLimited, timeLimited)
            .pipe(
                transform(z => z.value),
                notEmpty(),
            )
            .subscribe(observer);

        return new CompositeDisposable(publisher, sizeLimited.connect());
    });

    function CreateExpirableItem(item: TObject, key: TKey, orderItemWasAdded: number): ExpirableItem<TObject, TKey> {
        //check whether expiry has been set for any items
        const dateTime = scheduler.now();
        const removeAt = expireAfter?.(item);
        const expireAt = removeAt !== undefined ? dateTime + removeAt : -1;

        return {
            value: item,
            key,
            expireAt,
            index: orderItemWasAdded++,
        };
    }
}
