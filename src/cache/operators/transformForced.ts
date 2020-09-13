import { ConnectableObservable, merge, Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { map, publish } from 'rxjs/operators';
import { Cache } from '../Cache';
import { ChangeSet } from '../ChangeSet';
import { notEmpty } from './notEmpty';
import { transform } from './transform';
import { DynamicDataError } from '../DynamicDataError';
import { CompositeDisposable } from '../../util';
import { Change } from '../Change';
import { ChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Projects each update item to a new form using the specified transform function
 * @typeparam TDestination The type of the destination.
 * @typeparam TSource The type of the source.
 * @typeparam TKey The type of the key.
 * @param transformFactory The transform factory.
 * @param forceTransform Invoke to force a new transform for items matching the selected objects
 * @param exceptionCallback callback when exceptions happen
 */
export function transformForced<TSource, TKey, TDestination>(
    transformFactory: (current: TSource, key: TKey, previous: TSource | undefined) => TDestination,
    forceTransform: Observable<(value: TSource, key: TKey) => boolean>,
    exceptionCallback?: (error: DynamicDataError<TSource, TKey>) => void,
): ChangeSetOperatorFunction<TSource, TKey, TDestination>;
/**
 * Projects each update item to a new form using the specified transform function
 * @typeparam TDestination The type of the destination.
 * @typeparam TSource The type of the source.
 * @typeparam TKey The type of the key.
 * @param transformFactory The transform factory.
 * @param forceTransform Invoke to force a new transform for items matching the selected objects
 * @param exceptionCallback callback when exceptions happen
 */
export function transformForced<TSource, TKey, TDestination>(
    transformFactory: (current: TSource, key: TKey, previous: TSource | undefined) => TDestination,
    forceTransform: Observable<unknown>,
    exceptionCallback?: (error: DynamicDataError<TSource, TKey>) => void,
): ChangeSetOperatorFunction<TSource, TKey, TDestination>;
/**
 * Projects each update item to a new form using the specified transform function
 * @typeparam TDestination The type of the destination.
 * @typeparam TSource The type of the source.
 * @typeparam TKey The type of the key.
 * @param transformFactory The transform factory.
 * @param forceTransform Invoke to force a new transform for items matching the selected objects
 * @param exceptionCallback callback when exceptions happen
 */
export function transformForced<TSource, TKey, TDestination>(
    transformFactory: (current: TSource, key: TKey, previous: TSource | undefined) => TDestination,
    forceTransform: Observable<unknown | ((value: TSource, key: TKey) => boolean)>,
    exceptionCallback?: (error: DynamicDataError<TSource, TKey>) => void,
): ChangeSetOperatorFunction<TSource, TKey, TDestination> {
    return function forceTransformOperator(source) {
        return new Observable<IChangeSet<TDestination, TKey>>(observer => {
            const shared: ConnectableObservable<IChangeSet<TSource, TKey>> = source.pipe(publish()) as any;

            //capture all items so we can apply a forced transform
            const cache = new Cache<TSource, TKey>();
            const cacheLoader = shared.subscribe(changes => cache.clone(changes));

            //create change set of items where force refresh is applied
            const refresher: Observable<IChangeSet<TSource, TKey>> = forceTransform.pipe(
                map(z => (typeof z === 'function' ? z : (value: TSource, key: TKey) => true)),
                map(selector => captureChanges(cache, selector as any)),
                map(changes => new ChangeSet(changes)),
                notEmpty(),
            );

            const sourceAndRefreshes = merge(shared, refresher);

            //do raw transform
            const rawTransform = sourceAndRefreshes.pipe(transform(transformFactory, true, exceptionCallback));

            return new CompositeDisposable(cacheLoader, rawTransform.subscribe(observer), shared.connect());
        });

        // eslint-disable-next-line unicorn/consistent-function-scoping
        function* captureChanges(cache: Cache<TSource, TKey>, shouldTransform: (value: TSource, key: TKey) => boolean) {
            for (const [key, value] of cache.entries()) {
                if (shouldTransform(value, key)) {
                    yield new Change<TSource, TKey>('refresh', key, value);
                }
            }
        }
    };
}
