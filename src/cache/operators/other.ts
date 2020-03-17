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

import { BehaviorSubject, MonoTypeOperatorFunction, Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { ISortedChangeSet } from '../ISortedChangeSet';
import { Change } from '../Change';
import { SortedChangeSet } from '../SortedChangeSet';
import { groupBy, map, tap } from 'rxjs/operators';
import { CompositeDisposable, Disposable, IDisposable } from '../../util';
import { SourceCache } from '../SourceCache';
import { IObservableCache } from '../IObservableCache';
import { asObservableCache } from './asObservableCache';
import { ISourceUpdater } from '../ISourceUpdater';
import { transform } from './transform';
import { disposeMany } from './disposeMany';
import { from as ixFrom } from 'ix/iterable'
import { groupBy as ixGroupBy } from 'ix/iterable/operators'

/**
 * Converts moves changes to remove + add
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function treatMovesAsRemoveAdd<TObject, TKey>(): MonoTypeOperatorFunction<ISortedChangeSet<TObject, TKey>> {
    return function treatMovesAsRemoveAddOperator(source) {
        function* replaceMoves(items: IChangeSet<TObject, TKey>): Iterable<Change<TObject, TKey>> {
            for (const change of items) {
                if (change.reason === 'moved') {
                    yield new Change<TObject, TKey>('remove', change.key, change.current, change.previousIndex);
                    yield new Change<TObject, TKey>('add', change.key, change.current, change.currentIndex);
                } else {
                    yield change;
                }
            }
        }

        return source
            .pipe(map(changes => new SortedChangeSet<TObject, TKey>(changes.sortedItems, replaceMoves(changes)));
    };
}

/**
 * Node describing the relationship between and item and it's ancestors and descendent
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
public class Node<TObject, TKey> implements IDisposable {
    private readonly _children = new SourceCache<Node<TObject, TKey>, TKey>(n => n.key);
    private readonly _cleanUp: IDisposable;

    /**
     * Initializes a new instance of the <see cref="Node{TObject, TKey}"/> class.
     * @param item The item
     * @param key The key
     * @param parent The parent
     */
    public constructor(item: TObject, key: TKey, parent?: Node<TObject, TKey>) {
        this.item = item;
        this.key = key;
        this.parent = parent;
        this.children = asObservableCache(this._children);
        this._cleanUp = new CompositeDisposable(this.children, this._children);
    }

    /**
     * The item
     */
    public readonly item: TObject;

    /**
     * The key
     */
    public readonly key: TKey;

    /**
     * Gets the parent if it has one
     */
    public readonly parent?: Node<TObject, TKey>;

    /**
     * The child nodes
     */
    public readonly children: IObservableCache<Node<TObject, TKey>, TKey>;

    /**
     * Gets or sets a value indicating whether this instance is root.
     */
    public get isRoot() {
        return this.parent === undefined;
    }

    /**
     * Gets the depth i.e. how many degrees of separation from the parent
     */
    public get depth() {
        var i = 0;
        var parent = this.parent;
        do {
            if (parent === undefined) {
                break;
            }

            i++;
            parent = parent.parent;
        } while (true);
        return i;
    }

    /**
     * @internal
     */
    public update(updateAction: (updater: ISourceUpdater<Node<TObject, TKey>, TKey>) => void) {
        this._children.edit(updateAction);
    }

    public toString() {
        const count = this.children.size === 0 ? '' : ` (${this.children.size} children)`;
        return `${this.item}${count}`;
    }

    public dispose() {
        this._cleanUp.dispose();
    }
}


export function transformToTree<TObject, TKey>(
    pivotOn: (value: TObject) => TKey,
    predicateChanged?: Observable<(node: Node<TObject, TKey>) => boolean>,
): OperatorFunction<IChangeSet<TObject, TKey>, IChangeSet<Node<TObject, TKey>, TKey>> {
    return function transformToTreeOperator(source) {
        return new Observable<IChangeSet<Node<TObject, TKey>, TKey>>(observer =>
        {
            var refilterObservable = new BehaviorSubject<unknown>(null);

            var allData =  asObservableCache(source);

            //for each object we need a node which provides
            //a structure to set the parent and children
            var allNodes = asObservableCache(
                allData.connect()
                .pipe(
                    transform((t, v) => new Node(t, v))
                )
            );
            allNodes.connect()

            var groupedByPivot = asObservableCache(
                allNodes.connect()
                    .pipe(group(x => pivotOn(x.item)))
            );

            function updateChildren( parentNode: Node<TObject, TKey>)
            {
                var lookup = groupedByPivot.Lookup(parentNode.key);
                if (lookup.HasValue)
                {
                    var children = lookup.Value.Cache.Items;
                    parentNode.update(u => u.addOrUpdate(children));
                    children.ForEach(x => x.Parent = parentNode);
                }
            }

            //as nodes change, maintain parent and children
            var parentSetter = allNodes.connect()
                .pipe(tap(changes =>
                {
                    var grouped = ixFrom(changes).pipe(ixGroupBy(c => pivotOn(c.current.item)));

                    for (var group of grouped)
                    {
                        var parentKey = group.key;
                        var parent = allNodes.lookup(parentKey);

                        if (parent !== undefined)
                        {
                            //deal with items which have no parent
                            for (var change of group)
                            {
                                if (change.reason !== 'refresh')
                                {
                                    change.current.parent = null;
                                }

                                switch (change.reason)
                                {
                                    case 'add':
                                        updateChildren(change.current);
                                        break;
                                    case 'update':
                                    {
                                        //copy children to the new node amd set parent
                                        var children = change.previous!.children;
                                        change.current.update(updater => updater.addOrUpdate(children));
                                        children.forEach(child => child.parent = change.current);

                                        //remove from old parent if different
                                        var previous = change.previous!;
                                        var previousParent = pivotOn(previous.item);

                                        if (previousParent !== previous.key)
                                        {
                                            allNodes.lookup(previousParent)
                                                .IfHasValue(n => { n.Update(u => u.Remove(change.Key)); });
                                        }

                                        break;
                                    }

                                    case 'remove':
                                    {
                                        //remove children and null out parent
                                        var children = change.current.children.Items;
                                        change.current.update(updater => updater.remove(children));
                                        children.forEach(child => child.Parent = null);

                                        break;
                                    }

                                    case 'refresh':
                                    {
                                        var previousParent = change.current.parent;
                                        if (previousParent !== parent)
                                        {
                                            previousParent.IfHasValue(n => n.Update(u => u.Remove(change.Key)));
                                            change.current.parent = null;
                                        }

                                        break;
                                    }
                                }
                            }
                        }
                        else
                        {
                            //deal with items have a parent
                            parent.Value.Update(updater =>
                            {
                                var p = parent;

                                for (var change of group)
                                {
                                    var previous = change.previous;
                                    var node = change.current;
                                    var key = node.Key;

                                    switch (change.reason)
                                    {
                                        case 'add':
                                        {
                                            // update the parent node
                                            node.parent = p;
                                            updater.addOrUpdate(node);
                                            updateChildren(node);

                                            break;
                                        }

                                        case 'update':
                                        {
                                            //copy children to the new node amd set parent
                                            var children = previous.Value.Children.Items;
                                            change.Current.Update(u => u.AddOrUpdate(children));
                                            children.ForEach(child => child.Parent = change.Current);

                                            //check whether the item has a new parent
                                            var previousItem = previous.Value.Item;
                                            var previousKey = previous.Value.Key;
                                            var previousParent = _pivotOn(previousItem);

                                            if (!previousParent.Equals(previousKey))
                                            {
                                                allNodes.Lookup(previousParent)
                                                    .IfHasValue(n => { n.Update(u => u.Remove(key)); });
                                            }

                                            //finally update the parent
                                            node.Parent = p;
                                            updater.AddOrUpdate(node);

                                            break;
                                        }

                                        case 'remove':
                                        {
                                            node.Parent = null;
                                            updater.Remove(key);

                                            var children = node.Children.Items;
                                            change.Current.Update(u => u.Remove(children));
                                            children.ForEach(child => child.Parent = null);

                                            break;
                                        }

                                        case 'refresh':
                                        {
                                            var previousParent = change.Current.Parent;
                                            if (!previousParent.Equals(parent))
                                            {
                                                previousParent.IfHasValue(n => n.Update(u => u.Remove(change.Key)));
                                                change.Current.Parent = p;
                                                updater.AddOrUpdate(change.Current);
                                            }

                                            break;
                                        }
                                    }
                                }
                            });
                        }
                    }

                    refilterObservable.next(null);
                }),
                    disposeMany()
                )
                .Subscribe();

            var filter = _predicateChanged.CombineLatest(refilterObservable, (predicate, _) => predicate);
            var result = allNodes.Connect().Filter(filter).SubscribeSafe(observer);

            return Disposable.Create(() =>
            {
                result.Dispose();
                parentSetter.Dispose();
                allData.Dispose();
                allNodes.Dispose();
                groupedByPivot.Dispose();
                refilterObservable.OnCompleted();
            });
        });
    }
}

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

// return new TreeBuilder<TObject, TKey>(source, pivotOn, predicateChanged).Run();
// }

// #endregion

// #region Distinct values

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
