// TODO:
// /**
//  * Removes the key which enables all observable list features of dynamic data
// * @typeparam TObject The type of  object.
// * @typeparam TKey The type of  key.
// */
// export function removeKey<TObject, TKey>(): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
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

// /**
//  * Limits the size of the result set to the specified number

// * @typeparam TObject The type of the object.
// * @typeparam TKey The type of the key.
// * @param size The size.
// */
// public static IObservable<IVirtualChangeSet<TObject, TKey>> Top<TObject, TKey>(
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

import {} from 'rxjs';

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
