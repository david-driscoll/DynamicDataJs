import {
    ConnectableObservable,
    merge,
    MonoTypeOperatorFunction,
    Observable,
    OperatorFunction,
    Subject,
    defer,
    concat,
    scheduled,
    asapScheduler,
    queueScheduler,
    of,
    isObservable,
} from 'rxjs';
import { distinctUntilChanged, map, publish, scan, startWith, tap, filter } from 'rxjs/operators';
import { IChangeSet } from '../IChangeSet';
import { Change } from '../Change';
import { Cache } from '../Cache';
import { CompositeDisposable, Disposable, IDisposableOrSubscription, isDisposable, isSubscription } from '../../util';
import { from as ixFrom } from 'ix/iterable';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { notEmpty } from './notEmpty';
import { ChangeSet } from '../ChangeSet';
import { notificationsFor } from '../../notify';
import { ObjectType, Npc, npc, isNpc } from '../../notify/notifyPropertyChanged';

export type ConnectionStatus = 'pending' | 'loaded' | 'errored' | 'completed';
export type DynamicDataError<TObject, TKey> = { key: TKey; value: TObject; error: Error };

/**
 * Monitors the status of a stream
 * @typeparam T
 */
export function statusMonitor<T>(): OperatorFunction<T, ConnectionStatus> {
    return function statusMonitorOperator(source) {
        return new Observable<ConnectionStatus>(observer => {
            const statusSubject = new Subject<ConnectionStatus>();
            let status: ConnectionStatus = 'pending';

            function error(ex: Error) {
                status = 'errored';
                statusSubject.next(status);
                observer.error(ex);
            }

            function completion() {
                if (status == 'errored') {
                    return;
                }

                status = 'completed';
                statusSubject.next(status);
            }

            function updated() {
                if (status != 'pending') {
                    return;
                }

                status = 'loaded';
                statusSubject.next(status);
            }

            const monitor = source.subscribe(updated, error, completion);

            const subscriber = statusSubject.pipe(startWith(status), distinctUntilChanged()).subscribe(observer);

            return () => {
                statusSubject.complete();
                monitor.unsubscribe();
                subscriber.unsubscribe();
            };
        });
    };
}

/**
 * Provides a call back for each change
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param action The action.
 */
export function forEachChange<TObject, TKey>(action: (change: Change<TObject, TKey>) => void): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function forEachChangeOperator(source) {
        return source.pipe(tap(changes => changes.forEach(action)));
    };
}
/**
 * Disposes each item when no longer required.
 * Individual items are disposed when removed or replaced. All items
 * are disposed when the stream is disposed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function disposeMany<TObject, TKey>(removeAction?: (value: TObject) => void): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    if (!removeAction) {
        removeAction = function(value: TObject) {
            if (isDisposable(value)) value.dispose();
            if (isSubscription(value)) value.unsubscribe();
        };
    }

    return function disposeManyOperator(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const cache = new Cache<TObject, TKey>();
            const subscriber = source.pipe(tap(changes => registerForRemoval(changes, cache), observer.error)).subscribe(observer);

            return Disposable.create(() => {
                subscriber.unsubscribe();

                ixFrom(cache.values()).forEach(t => removeAction!(t));
                cache.clear();
            });
        });
    };

    function registerForRemoval(changes: IChangeSet<TObject, TKey>, cache: Cache<TObject, TKey>) {
        changes.forEach(change => {
            switch (change.reason) {
                case 'update':
                    if (change.previous) removeAction!(change.previous);
                    break;
                case 'remove':
                    removeAction!(change.current);
                    break;
            }
        });
        cache.clone(changes);
    }
}

/**
 * Projects each update item to a new form using the specified transform function
 * @typeparam TDestination The type of the destination.
 * @typeparam TSource The type of the source.
 * @typeparam TKey The type of the key.
 * @param transformFactory The transform factory.
 * @param transformOnRefresh Should a new transform be applied when a refresh event is received
 * @param exceptionCallback callback when exceptions happen
 */
export function transform<TObject, TKey, TDestination>(
    transformFactory: (current: TObject, previous: TObject | undefined, key: TKey) => TDestination,
    transformOnRefresh?: boolean,
    exceptionCallback?: (error: DynamicDataError<TObject, TKey>) => void
): OperatorFunction<IChangeSet<TObject, TKey>, IChangeSet<TDestination, TKey>> {
    return function transformOperator(source) {
        return source.pipe(
            scan((cache, changes) => {
                for (let change of changes) {
                    switch (change.reason) {
                        case 'add':
                        case 'update':
                            {
                                let transformed: TDestination;
                                if (exceptionCallback != null) {
                                    try {
                                        transformed = transformFactory(change.current, change.previous, change.key);
                                        cache.addOrUpdate(transformed, change.key);
                                    } catch (error) {
                                        exceptionCallback({ error: error, key: change.key, value: change.current });
                                    }
                                } else {
                                    transformed = transformFactory(change.current, change.previous, change.key);
                                    cache.addOrUpdate(transformed, change.key);
                                }
                            }
                            break;
                        case 'remove':
                            cache.remove(change.key);
                            break;
                        case 'refresh':
                            {
                                if (transformOnRefresh) {
                                    const transformed = transformFactory(change.current, change.previous, change.key);
                                    cache.addOrUpdate(transformed, change.key);
                                } else {
                                    cache.refresh(change.key);
                                }
                            }

                            break;
                        case 'moved':
                            //Do nothing !
                            break;
                    }
                }
                return cache;
            }, new ChangeAwareCache<TDestination, TKey>()),
            map(cache => cache.captureChanges()),
            notEmpty()
        );
    };
}

/**
 * Projects each update item to a new form using the specified transform function
 * @typeparam TDestination The type of the destination.
 * @typeparam TSource The type of the source.
 * @typeparam TKey The type of the key.
 * @param transformFactory The transform factory.
 * @param forceTransform Invoke to force a new transform for items matching the selected objects
 * @param exceptionCallback callback when exceptions happen
 */
export function forceTransform<TObject, TKey, TDestination>(
    transformFactory: (current: TObject, previous: TObject | undefined, key: TKey) => TDestination,
    forceTransform: Observable<(value: TObject, key: TKey) => boolean>,
    exceptionCallback?: (error: DynamicDataError<TObject, TKey>) => void
): OperatorFunction<IChangeSet<TObject, TKey>, IChangeSet<TDestination, TKey>> {
    return function forceTransformOperator(source) {
        return new Observable<IChangeSet<TDestination, TKey>>(observer => {
            const shared: ConnectableObservable<IChangeSet<TObject, TKey>> = source.pipe(publish()) as any;

            //capture all items so we can apply a forced transform
            const cache = new Cache<TObject, TKey>();
            const cacheLoader = shared.subscribe(changes => cache.clone(changes));

            //create change set of items where force refresh is applied
            const refresher: Observable<IChangeSet<TObject, TKey>> = forceTransform.pipe(
                map(selector => captureChanges(cache, selector)),
                map(changes => new ChangeSet(changes)),
                notEmpty()
            );

            const sourceAndRefreshes = merge(shared, refresher);

            //do raw transform
            const rawTransform = sourceAndRefreshes.pipe(transform(transformFactory, true, exceptionCallback));

            return new CompositeDisposable(cacheLoader, rawTransform.subscribe(observer), shared.connect());
        });

        // eslint-disable-next-line unicorn/consistent-function-scoping
        function* captureChanges(cache: Cache<TObject, TKey>, shouldTransform: (value: TObject, key: TKey) => boolean) {
            for (const [key, value] of cache.entries()) {
                if (shouldTransform(value, key)) {
                    yield new Change<TObject, TKey>('refresh', key, value);
                }
            }
        }
    };
}

/**
 * Subscribes to each item when it is added to the stream and unsubcribes when it is removed.  All items will be unsubscribed when the stream is disposed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param subscriptionFactory The subsription function
 */
export function subscribeMany<TObject, TKey>(
    subscriptionFactory: (value: TObject, key: TKey) => IDisposableOrSubscription
): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function subscribeManyOperator(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const published: ConnectableObservable<IChangeSet<TObject, TKey>> = source.pipe(publish()) as any;
            const subscriptions = published
                .pipe(
                    transform((c, p, k) => subscriptionFactory(c, k)),
                    disposeMany()
                )
                .subscribe();

            return new CompositeDisposable(subscriptions, published.subscribe(observer), published.connect());
        });
    };
}

export type ItemWithValue<TObject, TValue> = { item: TObject; value: TValue };

/**
 * Dynamically merges the observable which is selected from each item in the stream, and unmerges the item
 * when it is no longer part of the stream.
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TDestination The type of the destination.
 * @param observableSelector The observable selector.
 */
export function mergeManyItems<TObject, TKey, TDestination>(
    observableSelector: (value: TObject, key: TKey) => Observable<TDestination>
): OperatorFunction<IChangeSet<TObject, TKey>, ItemWithValue<TObject, TDestination>> {
    return function mergeManyItemsOperator(source) {
        return new Observable<ItemWithValue<TObject, TDestination>>(observer => {
            return source
                .pipe(
                    subscribeMany((t, v) =>
                        observableSelector(t, v)
                            .pipe(map(z => ({ item: t, value: z })))
                            .subscribe(observer)
                    )
                )
                .subscribe();
        });
    };
}
/**
 * Dynamically merges the observable which is selected from each item in the stream, and unmerges the item
 * when it is no longer part of the stream.
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TDestination The type of the destination.
 * @param observableSelector The observable selector.
 */

export function mergeMany<TObject, TKey, TDestination>(
    observableSelector: (value: TObject, key: TKey) => Observable<TDestination>
): OperatorFunction<IChangeSet<TObject, TKey>, TDestination> {
    return function mergeManyOperator(source) {
        return new Observable<TDestination>(observer => {
            return source.pipe(subscribeMany((t, v) => observableSelector(t, v).subscribe(x => observer.next(x)))).subscribe(
                x => {},
                ex => observer.error(ex),
                // TODO: Is this needed
                () => observer.complete()
            );
        });
    };
}

/**
 * Notifies when any any property on the object has changed
 * @typeparam TObject The type of the object
 * @param source The source
 * @param propertiesToMonitor specify properties to Monitor, or omit to monitor all property changes
 */
export function whenAnyPropertyChanged<TObject>(value: Npc<TObject>, ...keys: (keyof TObject)[]): Observable<TObject>;
/**
 * Watches each item in the collection and notifies when any of them has changed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param propertiesToMonitor specify properties to Monitor, or omit to monitor all property changes
 */
export function whenAnyPropertyChanged<TObject>(...keys: (keyof TObject)[]): MonoTypeOperatorFunction<TObject>;
export function whenAnyPropertyChanged<TObject>(value: Npc<TObject> | keyof TObject, ...keys: (keyof TObject)[]) {
    if (isNpc(value)) {
        return (keys.length > 0 ? notificationsFor(value).pipe(filter(property => keys.includes(property))) : notificationsFor(value)).pipe(
            map(z => value)
        );
    }
    return function
}

type PropertyValue<TObject, TKey extends keyof TObject> = { sender: TObject; value: TObject[TKey] };

function whenChangedValues<TObject, TKey extends keyof TObject>(
    value: Npc<TObject>,
    key: TKey,
    notifyInitial = true,
    fallbackValue?: () => TObject[TKey]
) {
    const propertyChanged = notificationsFor(value).pipe(
        filter(x => x === key),
        map(t => ({ sender: value, value: value[key] } as PropertyValue<Npc<TObject>, TKey>))
    );
    return notifyInitial
        ? concat(
              defer(() => of({ sender: value, value: value[key] || fallbackValue?.() } as PropertyValue<Npc<TObject>, TKey>)),
              propertyChanged
          )
        : propertyChanged;
}

export function whenChanged<TObject, TKey extends keyof TObject>(
    value: Npc<TObject>,
    key: TKey,
    notifyInitial = true,
    fallbackValue: () => TObject[TKey]
) {
    return whenChangedValues(value, key, notifyInitial, fallbackValue).pipe(
        filter(x => !!x.value),
        map(z => z.value)
    );
}

// public static IObservable < TObject > WhenAnyPropertyChanged<TObject, TKey>([NotNull] this IObservable < IChangeSet < TObject, TKey >> source, params string[] propertiesToMonitor)
// where TObject : INotifyPropertyChanged
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.MergeMany(t => t.WhenAnyPropertyChanged(propertiesToMonitor));
// }

// /**
//  * Watches each item in the collection and notifies when any of them has changed
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TValue The type of the value.
// * @param propertyAccessor The property accessor.
// * @param notifyOnInitialValue if set to <c>true</c> [notify on initial value].

// */public static IObservable<TValue> WhenValueChanged<TObject, TKey, TValue>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source,
// [NotNull] Expression<Func<TObject, TValue>> propertyAccessor,
// bool notifyOnInitialValue = true)
// where TObject : INotifyPropertyChanged
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (propertyAccessor == null)
// {
// throw new ArgumentNullException(nameof(propertyAccessor));
// }

// return source.MergeMany(t => t.WhenChanged(propertyAccessor, notifyOnInitialValue));
// }

// /**
//  * Watches each item in the collection and notifies when any of them has changed
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TValue The type of the value.
// * @param propertyAccessor The property accessor.
// * @param notifyOnInitialValue if set to <c>true</c> [notify on initial value].

// */public static IObservable<PropertyValue<TObject, TValue>> WhenPropertyChanged<TObject, TKey, TValue>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source,
// [NotNull] Expression<Func<TObject, TValue>> propertyAccessor,
// bool notifyOnInitialValue = true)
// where TObject : INotifyPropertyChanged
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (propertyAccessor == null)
// {
// throw new ArgumentNullException(nameof(propertyAccessor));
// }

// return source.MergeMany(t => t.WhenPropertyChanged(propertyAccessor, notifyOnInitialValue));
// }

// /**
//  * Subscribes to each item when it is added to the stream and unsubcribes when it is removed.  All items will be unsubscribed when the stream is disposed
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param subscriptionFactory The subsription function

// */public static IObservable<IChangeSet<TObject, TKey>> SubscribeMany<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, IDisposable> subscriptionFactory)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (subscriptionFactory == null)
// {
// throw new ArgumentNullException(nameof(subscriptionFactory));
// }

// return new SubscribeMany<TObject, TKey>(source, subscriptionFactory).Run();
// }

// /**
//  * Callback for each item as and when it is being added to the stream
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param addAction The add action.

// */public static IObservable<IChangeSet<TObject, TKey>> OnItemAdded<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, [NotNull] Action<TObject> addAction)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (addAction == null)
// {
// throw new ArgumentNullException(nameof(addAction));
// }

// return source.Do(changes => changes.Where(c => c.Reason == ChangeReason.Add)
// .ForEach(c => addAction(c.Current)));
// }

// /**
//  * Callback for each item as and when it is being removed from the stream
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param removeAction The remove action.

// */public static IObservable<IChangeSet<TObject, TKey>> OnItemRemoved<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, Action<TObject> removeAction)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (removeAction == null)
// {
// throw new ArgumentNullException(nameof(removeAction));
// }

// return source.Do(changes => changes.Where(c => c.Reason == ChangeReason.Remove)
// .ForEach(c => removeAction(c.Current)));
// }

// /**
//  * Callback when an item has been updated eg. (current, previous)=>{}
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param updateAction The update action.

// */public static IObservable<IChangeSet<TObject, TKey>> OnItemUpdated<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, Action<TObject, TObject> updateAction)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (updateAction == null)
// {
// throw new ArgumentNullException(nameof(updateAction));
// }

// return source.Do(changes => changes.Where(c => c.Reason == ChangeReason.Update)
// .ForEach(c => updateAction(c.Current, c.Previous.Value)));
// }

// /**
//  * Includes changes for the specified reasons only
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param reasons The reasons.

// */public static IObservable<IChangeSet<TObject, TKey>> WhereReasonsAre<TObject, TKey>(
// this IObservable<IChangeSet<TObject, TKey>> source, params ChangeReason[] reasons)
// {
// if (reasons == null)
// {
// throw new ArgumentNullException(nameof(reasons));
// }

// if (!reasons.Any())
// {
// throw new ArgumentException("Must select at least one reason");
// }

// var hashed = new HashSet<ChangeReason>(reasons);

// return source.Select(updates =>
// {
// return new ChangeSet<TObject, TKey>(updates.Where(u => hashed.Contains(u.Reason)));
// }).NotEmpty();
// }

// /**
//  * Excludes updates for the specified reasons
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param reasons The reasons.

// */public static IObservable<IChangeSet<TObject, TKey>> WhereReasonsAreNot<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, params ChangeReason[] reasons)
// {
// if (reasons == null)
// {
// throw new ArgumentNullException(nameof(reasons));
// }

// if (!reasons.Any())
// {
// throw new ArgumentException("Must select at least one reason");
// }

// var hashed = new HashSet<ChangeReason>(reasons);

// return source.Select(updates =>
// {
// return new ChangeSet<TObject, TKey>(updates.Where(u => !hashed.Contains(u.Reason)));
// }).NotEmpty();
// }

// #endregion

// #region Auto Refresh

// /**
//  * Automatically refresh downstream operators when any properties change.
// * @param changeSetBuffer Batch up changes by specifying the buffer. This greatly increases performance when many elements have sucessive property changes
// * @param propertyChangeThrottle When observing on multiple property changes, apply a throttle to prevent excessive refesh invocations
// * @param scheduler The scheduler

// */public static IObservable<IChangeSet<TObject, TKey>> AutoRefresh<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// TimeSpan? changeSetBuffer = null,
// TimeSpan? propertyChangeThrottle = null,
// IScheduler scheduler = null)
// where TObject : INotifyPropertyChanged
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.AutoRefreshOnObservable((t, v) =>
// {
// if (propertyChangeThrottle == null)
// {
// return t.WhenAnyPropertyChanged();
// }

// return t.WhenAnyPropertyChanged()
// .Throttle(propertyChangeThrottle.Value, scheduler ?? Scheduler.Default);
// }, changeSetBuffer, scheduler);
// }

// /**
//  * Automatically refresh downstream operators when properties change.
// * @param propertyAccessor Specify a property to observe changes. When it changes a Refresh is invoked
// * @param changeSetBuffer Batch up changes by specifying the buffer. This greatly increases performance when many elements have sucessive property changes
// * @param propertyChangeThrottle When observing on multiple property changes, apply a throttle to prevent excessive refesh invocations
// * @param scheduler The scheduler

// */public static IObservable<IChangeSet<TObject, TKey>> AutoRefresh<TObject, TKey, TProperty>(this IObservable<IChangeSet<TObject, TKey>> source,
// Expression<Func<TObject, TProperty>> propertyAccessor,
// TimeSpan? changeSetBuffer = null,
// TimeSpan? propertyChangeThrottle = null,
// IScheduler scheduler = null)
// where TObject : INotifyPropertyChanged
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.AutoRefreshOnObservable((t, v) =>
// {
// if (propertyChangeThrottle == null)
// {
// return t.WhenPropertyChanged(propertyAccessor, false);
// }

// return t.WhenPropertyChanged(propertyAccessor, false)
// .Throttle(propertyChangeThrottle.Value, scheduler ?? Scheduler.Default);
// }, changeSetBuffer, scheduler);
// }

// /**
//  * Automatically refresh downstream operator. The refresh is triggered when the observable receives a notification
// * @param reevaluator An observable which acts on items within the collection and produces a value when the item should be refreshed
// * @param changeSetBuffer Batch up changes by specifying the buffer. This greatly increases performance when many elements require a refresh
// * @param scheduler The scheduler

// */public static IObservable<IChangeSet<TObject, TKey>> AutoRefreshOnObservable<TObject, TKey, TAny>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, IObservable<TAny>> reevaluator,
// TimeSpan? changeSetBuffer = null,
// IScheduler scheduler = null)
// {
// return source.AutoRefreshOnObservable((t, v) => reevaluator(t), changeSetBuffer, scheduler);
// }

// /**
//  * Automatically refresh downstream operator. The refresh is triggered when the observable receives a notification
// * @param reevaluator An observable which acts on items within the collection and produces a value when the item should be refreshed
// * @param changeSetBuffer Batch up changes by specifying the buffer. This g  reatly increases performance when many elements require a refresh
// * @param scheduler The scheduler

// */public static IObservable<IChangeSet<TObject, TKey>> AutoRefreshOnObservable<TObject, TKey, TAny>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TKey, IObservable<TAny>> reevaluator,
// TimeSpan? changeSetBuffer = null,
// IScheduler scheduler = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (reevaluator == null)
// {
// throw new ArgumentNullException(nameof(reevaluator));
// }

// return new AutoRefresh<TObject, TKey, TAny>(source, reevaluator, changeSetBuffer,  scheduler).Run();
// }

// /**
//  * Supress  refresh notifications

// */public static IObservable<IChangeSet<TObject, TKey>> SupressRefresh<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source)
// {
// return source.WhereReasonsAreNot(ChangeReason.Refresh);
// }
// /**
//  * Prepends an empty changeset to the source

// */public static IObservable<IChangeSet<TObject, TKey>> StartWithEmpty<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source)
// {
// return source.StartWith(ChangeSet<TObject, TKey>.Empty);
// }

// /**
//  * Prepends an empty changeset to the source

// */public static IObservable<ISortedChangeSet<TObject, TKey>> StartWithEmpty<TObject, TKey>(this IObservable<ISortedChangeSet<TObject, TKey>> source)
// {
// return source.StartWith(SortedChangeSet<TObject, TKey>.Empty);
// }

// /**
//  * Prepends an empty changeset to the source

// */public static IObservable<IVirtualChangeSet<TObject, TKey>> StartWithEmpty<TObject, TKey>(this IObservable<IVirtualChangeSet<TObject, TKey>> source)
// {
// return source.StartWith(VirtualChangeSet<TObject, TKey>.Empty);
// }

// /**
//  * Prepends an empty changeset to the source

// */public static IObservable<IPagedChangeSet<TObject, TKey>> StartWithEmpty<TObject, TKey>(this IObservable<IPagedChangeSet<TObject, TKey>> source)
// {
// return source.StartWith(PagedChangeSet<TObject, TKey>.Empty);
// }

// /**
//  * Prepends an empty changeset to the source

// */public static IObservable<IGroupChangeSet<TObject, TKey, TGroupKey>> StartWithEmpty<TObject, TKey, TGroupKey>(this IObservable<IGroupChangeSet<TObject, TKey, TGroupKey>> source)
// {
// return source.StartWith(GroupChangeSet<TObject, TKey, TGroupKey>.Empty);
// }

// /**
//  * Prepends an empty changeset to the source

// */public static IObservable<IImmutableGroupChangeSet<TObject, TKey, TGroupKey>> StartWithEmpty<TObject, TKey, TGroupKey>(this IObservable<IImmutableGroupChangeSet<TObject, TKey, TGroupKey>> source)
// {
// return source.StartWith(ImmutableGroupChangeSet<TObject, TKey, TGroupKey>.Empty);
// }

// /**
//  * Prepends an empty changeset to the source

// */public static IObservable<IReadOnlyCollection<T>> StartWithEmpty<T>(this IObservable<IReadOnlyCollection<T>> source)
// {
// return source.StartWith(ReadOnlyCollectionLight<T>.Empty);
// }

// /**
//  * Removes the key which enables all observable list features of dynamic data
// * @typeparam TObject The type of  object.
// * @typeparam TKey The type of  key.

// */public static IObservable<IChangeSet<TObject>> RemoveKey<TObject, TKey>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.Select(changes =>
// {
// var enumerator = new RemoveKeyEnumerator<TObject, TKey>(changes);
// return new ChangeSet<TObject>(enumerator);
// });
// }

// /**
//  * Changes the primary key.
// * @typeparam TObject The type of the object.
// * @typeparam TSourceKey The type of the source key.
// * @typeparam TDestinationKey The type of the destination key.
// * @param keySelector The key selector eg. (item) => newKey;

// */public static IObservable<IChangeSet<TObject, TDestinationKey>> ChangeKey<TObject, TSourceKey, TDestinationKey>(this IObservable<IChangeSet<TObject, TSourceKey>> source, Func<TObject, TDestinationKey> keySelector)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (keySelector == null)
// {
// throw new ArgumentNullException(nameof(keySelector));
// }

// return source.Select(updates =>
// {
// var changed = updates.Select(u => new Change<TObject, TDestinationKey>(u.Reason, keySelector(u.Current), u.Current, u.Previous));
// return new ChangeSet<TObject, TDestinationKey>(changed);
// });
// }

// /**
//  * Changes the primary key.
// * @typeparam TObject The type of the object.
// * @typeparam TSourceKey The type of the source key.
// * @typeparam TDestinationKey The type of the destination key.
// * @param keySelector The key selector eg. (key, item) => newKey;

// */public static IObservable<IChangeSet<TObject, TDestinationKey>> ChangeKey<TObject, TSourceKey, TDestinationKey>(this IObservable<IChangeSet<TObject, TSourceKey>> source, Func<TSourceKey, TObject, TDestinationKey> keySelector)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (keySelector == null)
// {
// throw new ArgumentNullException(nameof(keySelector));
// }

// return source.Select(updates =>
// {
// var changed = updates.Select(u => new Change<TObject, TDestinationKey>(u.Reason, keySelector(u.Key, u.Current), u.Current, u.Previous));
// return new ChangeSet<TObject, TDestinationKey>(changed);
// });
// }

// /**
//  * Cast the object to the specified type.
//  * Alas, I had to add the converter due to type inference issues
// * @typeparam TSource The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TDestination The type of the destination.
// * @param converter The conversion factory.

// */public static IObservable<IChangeSet<TDestination, TKey>> Cast<TSource, TKey, TDestination>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, TDestination> converter)

// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return new Cast<TSource, TKey, TDestination>(source, converter).Run();
// }

// /**
//  * Buffers changes for an intial period only. After the period has elapsed, not further buffering occurs.
// * @param initalBuffer The period to buffer, measure from the time that the first item arrives
// * @param scheduler The scheduler to buffer on

// */public static IObservable<IChangeSet<TObject, TKey>> BufferInitial<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, TimeSpan initalBuffer, IScheduler scheduler = null)
// {
// return source.DeferUntilLoaded().Publish(shared =>
// {
// var initial = shared.Buffer(initalBuffer, scheduler ?? Scheduler.Default)
// .FlattenBufferResult()
// .Take(1);

// return initial.Concat(shared);
// });
// }

// /**
//  * Batches the updates for the specified time period
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param timeSpan The time span.
// * @param scheduler The scheduler.

// */public static IObservable<IChangeSet<TObject, TKey>> Batch<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// TimeSpan timeSpan,
// IScheduler scheduler = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.Buffer(timeSpan, scheduler ?? Scheduler.Default).FlattenBufferResult();
// }

// /**
//  * Convert the result of a buffer operation to a single change set
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.

// */public static IObservable<IChangeSet<TObject, TKey>> FlattenBufferResult<TObject, TKey>([NotNull] this IObservable<IList<IChangeSet<TObject, TKey>>> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.Where(x => x.Count != 0)
// .Select(updates => new ChangeSet<TObject, TKey>(updates.SelectMany(u => u)));
// }

// /**
//  * Batches the underlying updates if a pause signal (i.e when the buffer selector return true) has been received.
//  * When a resume signal has been received the batched updates will  be fired.
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param pauseIfTrueSelector When true, observable begins to buffer and when false, window closes and buffered result if notified
// * @param scheduler The scheduler.

// */public static IObservable<IChangeSet<TObject, TKey>> BatchIf<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservable<bool> pauseIfTrueSelector,
// IScheduler scheduler = null)
// {
// return BatchIf(source, pauseIfTrueSelector, false, scheduler);
// }

// /**
//  * Batches the underlying updates if a pause signal (i.e when the buffer selector return true) has been received.
//  * When a resume signal has been received the batched updates will  be fired.
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param pauseIfTrueSelector When true, observable begins to buffer and when false, window closes and buffered result if notified
// * @param intialPauseState if set to <c>true</c> [intial pause state].
// * @param scheduler The scheduler.

// */public static IObservable<IChangeSet<TObject, TKey>> BatchIf<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservable<bool> pauseIfTrueSelector,
// bool intialPauseState = false,
// IScheduler scheduler = null)
// {
// return new BatchIf<TObject, TKey>(source, pauseIfTrueSelector, null, intialPauseState, scheduler: scheduler).Run();
// }

// /**
//  * Batches the underlying updates if a pause signal (i.e when the buffer selector return true) has been received.
//  * When a resume signal has been received the batched updates will  be fired.
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param pauseIfTrueSelector When true, observable begins to buffer and when false, window closes and buffered result if notified
// * @param timeOut Specify a time to ensure the buffer window does not stay open for too long. On completion buffering will cease
// * @param scheduler The scheduler.

// */public static IObservable<IChangeSet<TObject, TKey>> BatchIf<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservable<bool> pauseIfTrueSelector,
// TimeSpan? timeOut = null,
// IScheduler scheduler = null)
// {
// return BatchIf(source, pauseIfTrueSelector, false, timeOut, scheduler);
// }

// /**
//  * Batches the underlying updates if a pause signal (i.e when the buffer selector return true) has been received.
//  * When a resume signal has been received the batched updates will  be fired.
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param pauseIfTrueSelector When true, observable begins to buffer and when false, window closes and buffered result if notified
// * @param intialPauseState if set to <c>true</c> [intial pause state].
// * @param timeOut Specify a time to ensure the buffer window does not stay open for too long. On completion buffering will cease
// * @param scheduler The scheduler.

// */public static IObservable<IChangeSet<TObject, TKey>> BatchIf<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservable<bool> pauseIfTrueSelector,
// bool intialPauseState = false,
// TimeSpan? timeOut = null,
// IScheduler scheduler = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (pauseIfTrueSelector == null)
// {
// throw new ArgumentNullException(nameof(pauseIfTrueSelector));
// }

// return new BatchIf<TObject, TKey>(source, pauseIfTrueSelector, timeOut, intialPauseState,scheduler: scheduler).Run();
// }

// /**
//  * Batches the underlying updates if a pause signal (i.e when the buffer selector return true) has been received.
//  * When a resume signal has been received the batched updates will  be fired.
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param pauseIfTrueSelector When true, observable begins to buffer and when false, window closes and buffered result if notified
// * @param intialPauseState if set to <c>true</c> [intial pause state].
// * @param timer Specify a time observable. The buffer will be emptied each time the timer produces a value and when it completes. On completion buffering will cease
// * @param scheduler The scheduler.

// */public static IObservable<IChangeSet<TObject, TKey>> BatchIf<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IObservable<bool> pauseIfTrueSelector,
// bool intialPauseState = false,
// IObservable<Unit> timer = null,
// IScheduler scheduler = null)
// {
// return new BatchIf<TObject, TKey>(source, pauseIfTrueSelector, null, intialPauseState, timer, scheduler: scheduler).Run();
// }

// /**
//  * Defer the subscribtion until loaded and skip initial changeset
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.

// */public static IObservable<IChangeSet<TObject, TKey>> SkipInitial<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.DeferUntilLoaded().Skip(1);
// }

// /**
//  * Defer the subscription until the stream has been inflated with data
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.

// */public static IObservable<IChangeSet<TObject, TKey>> DeferUntilLoaded<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return new DeferUntilLoaded<TObject, TKey>(source).Run();
// }

// /**
//  * Defer the subscription until the stream has been inflated with data
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.

// */public static IObservable<IChangeSet<TObject, TKey>> DeferUntilLoaded<TObject, TKey>(this IObservableCache<TObject, TKey> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return new DeferUntilLoaded<TObject, TKey>(source).Run();
// }

// #endregion

// #region True for all values

// /**
//  * Produces a boolean observable indicating whether the latest resulting value from all of the specified observables matches
//  * the equality condition. The observable is re-evaluated whenever
// ///
//  * i) The cache changes
//  * or ii) The inner observable changes
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TValue The type of the value.
// * @param observableSelector Selector which returns the target observable
// * @param equalityCondition The equality condition.

// */public static IObservable<bool> TrueForAll<TObject, TKey, TValue>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, IObservable<TValue>> observableSelector,
// Func<TValue, bool> equalityCondition)
// {
// return source.TrueFor(observableSelector,
// items => items.All(o => o.LatestValue.HasValue && equalityCondition(o.LatestValue.Value)));
// }

// /**
//  * Produces a boolean observable indicating whether the latest resulting value from all of the specified observables matches
//  * the equality condition. The observable is re-evaluated whenever
// ///
//  * i) The cache changes
//  * or ii) The inner observable changes
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TValue The type of the value.
// * @param observableSelector Selector which returns the target observable
// * @param equalityCondition The equality condition.

// */public static IObservable<bool> TrueForAll<TObject, TKey, TValue>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, IObservable<TValue>> observableSelector,
// Func<TObject, TValue, bool> equalityCondition)
// {
// return source.TrueFor(observableSelector,
// items => items.All(o => o.LatestValue.HasValue && equalityCondition(o.Item, o.LatestValue.Value)));
// }

// /**
//  * Produces a boolean observable indicating whether the resulting value of whether any of the specified observables matches
//  * the equality condition. The observable is re-evaluated whenever
//  * i) The cache changes.
//  * or ii) The inner observable changes.
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TValue The type of the value.
// * @param observableSelector The observable selector.
// * @param equalityCondition The equality condition.

// */public static IObservable<bool> TrueForAny<TObject, TKey, TValue>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, IObservable<TValue>> observableSelector,
// Func<TObject, TValue, bool> equalityCondition)
// {
// return source.TrueFor(observableSelector,
// items => items.Any(o => o.LatestValue.HasValue && equalityCondition(o.Item, o.LatestValue.Value)));
// }

// /**
//  * Produces a boolean observable indicating whether the resulting value of whether any of the specified observables matches
//  * the equality condition. The observable is re-evaluated whenever
//  * i) The cache changes.
//  * or ii) The inner observable changes.
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TValue The type of the value.
// * @param observableSelector The observable selector.
// * @param equalityCondition The equality condition.

// */public static IObservable<bool> TrueForAny<TObject, TKey, TValue>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, IObservable<TValue>> observableSelector,
// Func<TValue, bool> equalityCondition)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (observableSelector == null)
// {
// throw new ArgumentNullException(nameof(observableSelector));
// }

// if (equalityCondition == null)
// {
// throw new ArgumentNullException(nameof(equalityCondition));
// }

// return source.TrueFor(observableSelector,
// items => items.Any(o => o.LatestValue.HasValue && equalityCondition(o.LatestValue.Value)));
// }

// private static IObservable<bool> TrueFor<TObject, TKey, TValue>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, IObservable<TValue>> observableSelector,
// Func<IEnumerable<ObservableWithValue<TObject, TValue>>, bool> collectionMatcher)
// {
// return new TrueFor<TObject, TKey, TValue>(source, observableSelector, collectionMatcher).Run();
// }

// /**
//  *  The latest copy of the cache is exposed for querying after each modification to the underlying data
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TDestination The type of the destination.
// * @param resultSelector The result selector.

// */public static IObservable<TDestination> QueryWhenChanged<TObject, TKey, TDestination>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<IQuery<TObject, TKey>, TDestination> resultSelector)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (resultSelector == null)
// {
// throw new ArgumentNullException(nameof(resultSelector));
// }

// return source.QueryWhenChanged().Select(resultSelector);
// }

// /**
//  * The latest copy of the cache is exposed for querying i)  after each modification to the underlying data ii) upon subscription
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.

// */public static IObservable<IQuery<TObject, TKey>> QueryWhenChanged<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return new QueryWhenChanged<TObject, TKey, Unit>(source).Run();
// }

// /**
//  * The latest copy of the cache is exposed for querying i)  after each modification to the underlying data ii) on subscription
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TValue The type of the value.
// * @param itemChangedTrigger Should the query be triggered for observables on individual items

// */public static IObservable<IQuery<TObject, TKey>> QueryWhenChanged<TObject, TKey, TValue>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source,
// [NotNull] Func<TObject, IObservable<TValue>> itemChangedTrigger)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (itemChangedTrigger == null)
// {
// throw new ArgumentNullException(nameof(itemChangedTrigger));
// }

// return new QueryWhenChanged<TObject, TKey, TValue>(source, itemChangedTrigger).Run();
// }

// /**
//  * Converts the changeset into a fully formed collection. Each change in the source results in a new collection
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.

// */public static IObservable<IReadOnlyCollection<TObject>> ToCollection<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source)
// {
// return source.QueryWhenChanged(query => new ReadOnlyCollectionLight<TObject>(query.Items));
// }

// /**
//  * Converts the changeset into a fully formed sorted collection. Each change in the source results in a new sorted collection
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @typeparam TSortKey The sort key
// * @param sort The sort function
// * @param sortOrder The sort order. Defaults to ascending

// */public static IObservable<IReadOnlyCollection<TObject>> ToSortedCollection<TObject, TKey, TSortKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TSortKey> sort, SortDirection sortOrder = SortDirection.Ascending)
// {
// return source.QueryWhenChanged(query => sortOrder == SortDirection.Ascending
// ? new ReadOnlyCollectionLight<TObject>(query.Items.OrderBy(sort))
// : new ReadOnlyCollectionLight<TObject>(query.Items.OrderByDescending(sort)));
// }

// /**
//  * Converts the changeset into a fully formed sorted collection. Each change in the source results in a new sorted collection
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param comparer The sort comparer

// */public static IObservable<IReadOnlyCollection<TObject>> ToSortedCollection<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// IComparer<TObject> comparer)
// {
// return source.QueryWhenChanged(query =>
// {
// var items = query.Items.AsList();
// items.Sort(comparer);
// return new ReadOnlyCollectionLight<TObject>(items);
// });
// }

// /**
//  * Watches updates for a single value matching the specified key
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param key The key.

// */public static IObservable<TObject> WatchValue<TObject, TKey>(this IObservableCache<TObject, TKey> source, TKey key)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.Watch(key).Select(u => u.Current);
// }

// /**
//  * Watches updates for a single value matching the specified key
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param key The key.

// */public static IObservable<TObject> WatchValue<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, TKey key)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.Watch(key).Select(u => u.Current);
// }

// /**
//  * Returns an observable of any updates which match the specified key,  preceeded with the initital cache state
// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param key The key.

// */public static IObservable<Change<TObject, TKey>> Watch<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, TKey key)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return source.SelectMany(updates => updates).Where(update => update.Key.Equals(key));
// }

// /**
//  * Clones the changes  into the specified collection

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param target The target.

// */public static IObservable<IChangeSet<TObject, TKey>> Clone<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, [NotNull] ICollection<TObject> target)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (target == null)
// {
// throw new ArgumentNullException(nameof(target));
// }

// return source.Do(changes =>
// {
// foreach (var item in changes)
// {
// switch (item.Reason)
// {
// case ChangeReason.Add:
// {
// target.Add(item.Current);
// }

// break;
// case ChangeReason.Update:
// {
// target.Remove(item.Previous.Value);
// target.Add(item.Current);
// }

// break;
// case ChangeReason.Remove:
// target.Remove(item.Current);
// break;
// }
// }
// });
// }

// #endregion

// #region Auto removal

// /**
//  * Automatically removes items from the stream after the time specified by
//  * the timeSelector elapses.  Return null if the item should never be removed

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param timeSelector The time selector.
// public static IObservable<IChangeSet<TObject, TKey>> ExpireAfter<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TimeSpan?> timeSelector)
// {
// return ExpireAfter(source, timeSelector, Scheduler.Default);
// }

// /**
//  * Automatically removes items from the stream after the time specified by
//  * the timeSelector elapses.  Return null if the item should never be removed

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param timeSelector The time selector.
// * @param scheduler The scheduler.
// */public static IObservable<IChangeSet<TObject, TKey>> ExpireAfter<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TimeSpan?> timeSelector, IScheduler scheduler)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (timeSelector == null)
// {
// throw new ArgumentNullException(nameof(timeSelector));
// }

// return source.ExpireAfter(timeSelector, null, scheduler);
// }

// /**
//  * Automatically removes items from the stream on the next poll after the time specified by
//  * the time selector elapses

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param source The cache.
// * @param timeSelector The time selector.  Return null if the item should never be removed
// * @param pollingInterval The polling interval.  if this value is specified,  items are expired on an interval. This will result in a loss of accuracy of the time which the item is expired but is less computationally expensive.
// public static IObservable<IChangeSet<TObject, TKey>> ExpireAfter<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TimeSpan?> timeSelector, TimeSpan? pollingInterval)
// {
// return ExpireAfter(source, timeSelector, pollingInterval, Scheduler.Default);
// }

// /**
//  * Automatically removes items from the stream on the next poll after the time specified by
//  * the time selector elapses

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param source The cache.
// * @param timeSelector The time selector.  Return null if the item should never be removed
// * @param pollingInterval The polling interval.  if this value is specified,  items are expired on an interval. This will result in a loss of accuracy of the time which the item is expired but is less computationally expensive.
// * @param scheduler The scheduler.
// */public static IObservable<IChangeSet<TObject, TKey>> ExpireAfter<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
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

// return new TimeExpirer<TObject, TKey>(source, timeSelector, pollingInterval, scheduler).ExpireAfter();
// }

// /**
//  * Automatically removes items from the cache after the time specified by
//  * the time selector elapses.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param source The cache.
// * @param timeSelector The time selector.  Return null if the item should never be removed
// * @param interval The polling interval.  Since multiple timer subscriptions can be expensive, it may be worth setting the interval.
// * @param scheduler The scheduler.
// internal static IObservable<IEnumerable<KeyValuePair<TKey, TObject>>> ForExpiry<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
// Func<TObject, TimeSpan?> timeSelector,
// TimeSpan? interval,
// IScheduler scheduler)
// {
// return new TimeExpirer<TObject, TKey>(source, timeSelector, interval, scheduler).ForExpiry();
// }

// /**
//  * Applies a size limiter to the number of records which can be included in the
//  * underlying cache.  When the size limit is reached the oldest items are removed.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param size The size.
// */public static IObservable<IChangeSet<TObject, TKey>> LimitSizeTo<TObject, TKey>(
// this IObservable<IChangeSet<TObject, TKey>> source, int size)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (size <= 0)
// {
// throw new ArgumentException("Size limit must be greater than zero");
// }

// return new SizeExpirer<TObject, TKey>(source, size).Run();
// }

// #endregion

// #region Paged

// /**
//  * Returns the page as specified by the pageRequests observable

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param pageRequests The page requests.

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

// #endregion

// #region  Filter

// /**
//  * Filters the specified source.

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param filter The filter.

// */public static IObservable<IChangeSet<TObject, TKey>> Filter<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source, Func<TObject, bool> filter)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// return new StaticFilter<TObject, TKey>(source, filter).Run();
// }

// /**
//  * Creates a filtered stream which can be dynamically filtered

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param predicateChanged Observable to change the underlying predicate.

// public static IObservable<IChangeSet<TObject, TKey>> Filter<TObject, TKey>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source,
// [NotNull] IObservable<Func<TObject, bool>> predicateChanged)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (predicateChanged == null)
// {
// throw new ArgumentNullException(nameof(predicateChanged));
// }

// return new DynamicFilter<TObject, TKey>(source, predicateChanged).Run();
// }

// /**
//  * Creates a filtered stream which can be dynamically filtered

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param reapplyFilter Observable to re-evaluate whether the filter still matches items. Use when filtering on mutable values

// */public static IObservable<IChangeSet<TObject, TKey>> Filter<TObject, TKey>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source,
// [NotNull] IObservable<Unit> reapplyFilter)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (reapplyFilter == null)
// {
// throw new ArgumentNullException(nameof(reapplyFilter));
// }

// var empty = Observable.Empty<Func<TObject, bool>>();
// return new DynamicFilter<TObject, TKey>(source, empty, reapplyFilter).Run();
// }

// /**
//  * Creates a filtered stream which can be dynamically filtered

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param reapplyFilter Observable to re-evaluate whether the filter still matches items. Use when filtering on mutable values
// * @param predicateChanged Observable to change the underlying predicate.

// public static IObservable<IChangeSet<TObject, TKey>> Filter<TObject, TKey>([NotNull] this IObservable<IChangeSet<TObject, TKey>> source,
// [NotNull] IObservable<Func<TObject, bool>> predicateChanged,
// [NotNull] IObservable<Unit> reapplyFilter)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (predicateChanged == null)
// {
// throw new ArgumentNullException(nameof(predicateChanged));
// }

// if (reapplyFilter == null)
// {
// throw new ArgumentNullException(nameof(reapplyFilter));
// }

// return new DynamicFilter<TObject, TKey>(source, predicateChanged, reapplyFilter).Run();
// }

// /**
//  * Updates the index for an object which implements IIndexAware

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.

// */public static IObservable<ISortedChangeSet<TObject, TKey>> UpdateIndex<TObject, TKey>(this IObservable<ISortedChangeSet<TObject, TKey>> source)
// where TObject : IIndexAware
// {
// return source.Do(changes => changes.SortedItems.Select((update, index) => new { update, index })
// .ForEach(u => u.update.Value.Index = u.index));
// }

// /**
//  * Invokes Refresh method for an object which implements IEvaluateAware

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.

// public static IObservable<IChangeSet<TObject, TKey>> InvokeEvaluate<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source)
// where TObject : IEvaluateAware
// {
// return source.Do(changes => changes.Where(u => u.Reason == ChangeReason.Refresh).ForEach(u => u.Current.Evaluate()));
// }

// #endregion

// #region Sort

// private const int DefaultSortResetThreshold = 100;

// /**
//  * Sorts using the specified comparer.
//  * Returns the underlying ChangeSet as as per the system conventions.
//  * The resulting changeset also exposes a sorted key value collection of of the underlying cached data

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param comparer The comparer.
// * @param sortOptimisations Sort optimisation flags. Specify one or more sort optimisations
// * @param resetThreshold The number of updates before the entire list is resorted (rather than inline sort)
// */public static IObservable<ISortedChangeSet<TObject, TKey>> Sort<TObject, TKey>(this IObservable<IChangeSet<TObject, TKey>> source,
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

// //public static IObservable<IChangeSet<TDestination, TDestinationKey>> Or<TDestination, TDestinationKey, TSource, TSourceKey>(this IObservable<IObservableCache<TSource, TSourceKey>> source,
// //    Func<TSource, IObservable<IChangeSet<TDestination, TDestinationKey>>> manyselector)
// //{
// //    return new TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(source, manyselector, keySelector).Run();
// //}

// //public static IObservable<IChangeSet<TDestination, TDestinationKey>> Or<TDestination, TDestinationKey, TSource, TSourceKey>(this IObservable<ISourceCache<TSource, TSourceKey>> source,
// //    Func<TSource, IObservable<IChangeSet<TDestination, TDestinationKey>>> manyselector)
// //{
// //    return new TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(source, manyselector, keySelector).Run();
// //}

// //public static IObservable<IChangeSet<TDestination, TDestinationKey>> TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(this IObservable<IChangeSet<TSource, TSourceKey>> source,
// //    Func<TSource, IObservableCache<TDestination, TDestinationKey>> manyselector)
// //{
// //    return new TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(source, manyselector, keySelector).Run();
// //}

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

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param maximumConcurrency The maximum concurrent tasks used to perform transforms.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformAsync<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, Task<TDestination>> transformFactory,
// IObservable<Func<TSource, TKey, bool>> forceTransform = null,
// int maximumConcurrency = 1)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// return source.TransformAsync((current, previous, key) => transformFactory(current), maximumConcurrency, forceTransform);
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param maximumConcurrency The maximum concurrent tasks used to perform transforms.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformAsync<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, TKey, Task<TDestination>> transformFactory,
// int maximumConcurrency = 1,
// IObservable<Func<TSource, TKey, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// return source.TransformAsync((current, previous, key) => transformFactory(current, key), maximumConcurrency, forceTransform);
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param maximumConcurrency The maximum concurrent tasks used to perform transforms.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformAsync<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, Optional<TSource>, TKey, Task<TDestination>> transformFactory,
// int maximumConcurrency = 1,
// IObservable<Func<TSource, TKey, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// return new TransformAsync<TDestination, TSource, TKey>(source, transformFactory, null, maximumConcurrency, forceTransform).Run();
// }

// #endregion

// #region Transform many

// /**
//  * Equivalent to a select many transform. To work, the key must individually identify each child.

// * @typeparam TDestination The type of the destination.
// * @typeparam TDestinationKey The type of the destination key.
// * @typeparam TSource The type of the source.
// * @typeparam TSourceKey The type of the source key.
// * @param manyselector The manyselector.
// * @param keySelector The key selector which must be unique across all
// */public static IObservable<IChangeSet<TDestination, TDestinationKey>> TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(
// this IObservable<IChangeSet<TSource, TSourceKey>> source,
// Func<TSource, IEnumerable<TDestination>> manyselector,
// Func<TDestination, TDestinationKey> keySelector)
// {
// return new TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(source, manyselector, keySelector).Run();
// }

// /**
//  * Flatten the nested observable collection, and subsequently observe observable collection changes

// * @typeparam TDestination The type of the destination.
// * @typeparam TDestinationKey The type of the destination key.
// * @typeparam TSource The type of the source.
// * @typeparam TSourceKey The type of the source key.
// * @param manyselector The manyselector.
// * @param keySelector The key selector which must be unique across all
// */public static IObservable<IChangeSet<TDestination, TDestinationKey>> TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(
// this IObservable<IChangeSet<TSource, TSourceKey>> source,
// Func<TSource, ObservableCollection<TDestination>> manyselector,
// Func<TDestination, TDestinationKey> keySelector)
// {
// return new TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(source, manyselector, keySelector).Run();
// }

// /**
//  * Flatten the nested observable collection, and subsequently observe observable collection changes

// * @typeparam TDestination The type of the destination.
// * @typeparam TDestinationKey The type of the destination key.
// * @typeparam TSource The type of the source.
// * @typeparam TSourceKey The type of the source key.
// * @param manyselector The manyselector.
// * @param keySelector The key selector which must be unique across all
// */public static IObservable<IChangeSet<TDestination, TDestinationKey>> TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>( this IObservable<IChangeSet<TSource, TSourceKey>> source,
// Func<TSource, ReadOnlyObservableCollection<TDestination>> manyselector,
// Func<TDestination, TDestinationKey> keySelector)
// {
// return new TransformMany<TDestination, TDestinationKey, TSource, TSourceKey>(source, manyselector, keySelector).Run();
// }

// #endregion

// #region Transform safe

// /**
//  * Projects each update item to a new form using the specified transform function,
//  * providing an error handling action to safely handle transform errors without killing the stream.

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param errorHandler Provides the option to safely handle errors without killing the stream.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafe<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, TDestination> transformFactory, Action<Error<TSource, TKey>> errorHandler, IObservable<Func<TSource, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (errorHandler == null)
// {
// throw new ArgumentNullException(nameof(errorHandler));
// }

// return source.TransformSafe((current, previous, key) => transformFactory(current), errorHandler, forceTransform.ForForced<TSource, TKey>());
// }

// /**
//  * Projects each update item to a new form using the specified transform function,
//  * providing an error handling action to safely handle transform errors without killing the stream.

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param errorHandler Provides the option to safely handle errors without killing the stream.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafe<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, TKey, TDestination> transformFactory, Action<Error<TSource, TKey>> errorHandler, IObservable<Func<TSource, TKey, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (errorHandler == null)
// {
// throw new ArgumentNullException(nameof(errorHandler));
// }

// return source.TransformSafe((current, previous, key) => transformFactory(current, key), errorHandler, forceTransform);
// }

// /**
//  * Projects each update item to a new form using the specified transform function,
//  * providing an error handling action to safely handle transform errors without killing the stream.

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param errorHandler Provides the option to safely handle errors without killing the stream.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafe<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, Optional<TSource>, TKey, TDestination> transformFactory,
// Action<Error<TSource, TKey>> errorHandler,
// IObservable<Func<TSource, TKey, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (errorHandler == null)
// {
// throw new ArgumentNullException(nameof(errorHandler));
// }

// if (forceTransform != null)
// {
// return new TransformWithForcedTransform<TDestination, TSource, TKey>(source, transformFactory, forceTransform, errorHandler).Run();
// }

// return new Transform<TDestination, TSource, TKey>(source, transformFactory, errorHandler).Run();
// }

// /**
//  * Projects each update item to a new form using the specified transform function,
//  * providing an error handling action to safely handle transform errors without killing the stream.

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for all items
// * @param errorHandler Provides the option to safely handle errors without killing the stream.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafe<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source, Func<TSource, TDestination> transformFactory, Action<Error<TSource, TKey>> errorHandler, IObservable<Unit> forceTransform)
// {
// return source.TransformSafe((cur, prev, key) => transformFactory(cur), errorHandler, forceTransform.ForForced<TSource, TKey>());
// }

// /**
//  * Projects each update item to a new form using the specified transform function,
//  * providing an error handling action to safely handle transform errors without killing the stream.

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for all items#
// * @param errorHandler Provides the option to safely handle errors without killing the stream.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafe<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, TKey, TDestination> transformFactory, Action<Error<TSource, TKey>> errorHandler, IObservable<Unit> forceTransform)
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

// return source.TransformSafe((cur, prev, key) => transformFactory(cur, key), errorHandler, forceTransform.ForForced<TSource, TKey>());
// }

// /**
//  * Projects each update item to a new form using the specified transform function,
//  * providing an error handling action to safely handle transform errors without killing the stream.

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param forceTransform Invoke to force a new transform for all items#
// * @param errorHandler Provides the option to safely handle errors without killing the stream.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafe<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, Optional<TSource>, TKey, TDestination> transformFactory,
// Action<Error<TSource, TKey>> errorHandler,
// IObservable<Unit> forceTransform)
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

// return source.TransformSafe(transformFactory, errorHandler, forceTransform.ForForced<TSource, TKey>());
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param errorHandler The error handler.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param maximumConcurrency The maximum concurrent tasks used to perform transforms.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafeAsync<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, Task<TDestination>> transformFactory,
// Action<Error<TSource, TKey>> errorHandler,
// IObservable<Func<TSource, TKey, bool>> forceTransform = null,
// int maximumConcurrency = 1)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (errorHandler == null)
// {
// throw new ArgumentNullException(nameof(errorHandler));
// }

// return source.TransformSafeAsync((current, previous, key) => transformFactory(current), errorHandler, maximumConcurrency, forceTransform);
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param errorHandler The error handler.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param maximumConcurrency The maximum concurrent tasks used to perform transforms.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafeAsync<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, TKey, Task<TDestination>> transformFactory,
// Action<Error<TSource, TKey>> errorHandler,
// int maximumConcurrency = 1,
// IObservable<Func<TSource, TKey, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (errorHandler == null)
// {
// throw new ArgumentNullException(nameof(errorHandler));
// }

// return source.TransformSafeAsync((current, previous, key) => transformFactory(current, key), errorHandler, maximumConcurrency, forceTransform);
// }

// /**
//  * Projects each update item to a new form using the specified transform function

// * @typeparam TDestination The type of the destination.
// * @typeparam TSource The type of the source.
// * @typeparam TKey The type of the key.
// * @param transformFactory The transform factory.
// * @param errorHandler The error handler.
// * @param forceTransform Invoke to force a new transform for items matching the selected objects
// * @param maximumConcurrency The maximum concurrent tasks used to perform transforms.
// */public static IObservable<IChangeSet<TDestination, TKey>> TransformSafeAsync<TDestination, TSource, TKey>(this IObservable<IChangeSet<TSource, TKey>> source,
// Func<TSource, Optional<TSource>, TKey, Task<TDestination>> transformFactory,
// Action<Error<TSource, TKey>> errorHandler,
// int maximumConcurrency = 1,
// IObservable<Func<TSource, TKey, bool>> forceTransform = null)
// {
// if (source == null)
// {
// throw new ArgumentNullException(nameof(source));
// }

// if (transformFactory == null)
// {
// throw new ArgumentNullException(nameof(transformFactory));
// }

// if (errorHandler == null)
// {
// throw new ArgumentNullException(nameof(errorHandler));
// }

// return new TransformAsync<TDestination, TSource, TKey>(source, transformFactory, errorHandler, maximumConcurrency, forceTransform).Run();
// }

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
