import { merge, Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { DynamicDataError } from '../DynamicDataError';
import { Change } from '../Change';
import { ChangeSet } from '../ChangeSet';
import { from } from 'rxjs';
import { from as ixFrom } from 'ix/iterable';
import { filter as ixFilter, map as ixMap } from 'ix/iterable/operators';
import { concatMapTo, map, mergeAll, toArray } from 'rxjs/operators';
import { ChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Projects each update item to a new form using the specified transform function
 * @category Operator
 * @typeparam TDestination The type of the destination.
 * @typeparam TSource The type of the source.
 * @typeparam TKey The type of the key.
 * @param transformFactory The transform factory.
 * @param transformOnRefresh Should a new transform be applied when a refresh event is received
 * @param maximumConcurrency The maximum concurrent tasks used to perform transforms.
 * @param exceptionCallback callback when exceptions happen
 * @param forceTransform Invoke to force a new transform for items matching the selected objects
 */
export function transformPromise<TSource, TKey, TDestination>(
    transformFactory: (current: TSource, previous: TSource | undefined, key: TKey) => Promise<TDestination>,
    transformOnRefresh: boolean = true,
    maximumConcurrency: number = 1,
    exceptionCallback?: (error: DynamicDataError<TSource, TKey>) => void,
    forceTransform?: Observable<(source: TSource, key: TKey) => boolean>,
): ChangeSetOperatorFunction<TSource, TKey, TDestination, TKey> {
    type TransformResult =
        | {
              change: Change<TSource, TKey>;
              container: TransformedItemContainer;
              success: true;
              key: TKey;
          }
        | {
              change: Change<TSource, TKey>;
              container: undefined;
              success: true;
              key: TKey;
          }
        | {
              change: Change<TSource, TKey>;
              error: Error;
              success: false;
              key: TKey;
          };

    type TransformedItemContainer = { source: TSource; destination: TDestination };

    return function transformPromiseOperator(source) {
        return new Observable<IChangeSet<TDestination, TKey>>(observer => {
            const cache = new ChangeAwareCache<TransformedItemContainer, TKey>();

            let transformer = source.pipe(
                map(changes => from(doTransformChanges(cache, changes))),
                mergeAll(maximumConcurrency),
            );

            if (forceTransform != undefined) {
                const forced = forceTransform.pipe(
                    map(shouldTransform => from(doTransform(cache, shouldTransform))),
                    mergeAll(maximumConcurrency),
                );

                transformer = merge(transformer, forced);
            }

            return transformer.subscribe(observer);
        });
    };

    async function doTransform(
        cache: ChangeAwareCache<TransformedItemContainer, TKey>,
        shouldTransform: (source: TSource, key: TKey) => boolean,
    ): Promise<IChangeSet<TDestination, TKey>> {
        const toTransform = ixFrom(cache.entries()).pipe(
            ixFilter(([key, value]) => shouldTransform(value.source, key)),
            ixMap(([key, value]) => Change.update(key, value.source, value.source)),
        );

        const transformed = await from(toTransform)
            .pipe(
                map(z => transform(z)),
                mergeAll(maximumConcurrency),
                toArray(),
            )
            .toPromise();

        return processUpdates(cache, transformed);
    }

    async function doTransformChanges(cache: ChangeAwareCache<TransformedItemContainer, TKey>, changes: IChangeSet<TSource, TKey>): Promise<IChangeSet<TDestination, TKey>> {
        const transformed = await from(changes)
            .pipe(
                map(z => transform(z)),
                mergeAll(maximumConcurrency),
                toArray(),
            )
            .toPromise();
        return processUpdates(cache, transformed);
    }

    async function transform(change: Change<TSource, TKey>): Promise<TransformResult> {
        try {
            if (change.reason == 'add' || change.reason == 'update') {
                const destination = await transformFactory(change.current, change.previous, change.key);
                return createTransformResult(change, { source: change.current, destination });
            }

            return createTransformResult(change);
        } catch (error) {
            //only handle errors if a handler has been specified
            if (exceptionCallback != undefined) {
                return createTransformError(change, error);
            }

            throw error;
        }
    }

    function processUpdates(cache: ChangeAwareCache<TransformedItemContainer, TKey>, transformedItems: TransformResult[]): IChangeSet<TDestination, TKey> {
        //check for errors and callback if a handler has been specified
        const errors = transformedItems.filter(t => !t.success);
        if (errors.length > 0) {
            errors.forEach(t => {
                if (t.success) return;
                exceptionCallback?.({ key: t.key, value: t.change.current, error: t.error });
            });
        }

        for (const result of transformedItems) {
            if (!result.success) {
                exceptionCallback?.({ key: result.key, value: result.change.current, error: result.error });
                continue;
            }
            const key = result.key;
            switch (result.change.reason) {
                case 'add':
                case 'update':
                    cache.addOrUpdate(result.container!, key);
                    break;

                case 'remove':
                    cache.removeKey(key);
                    break;

                case 'refresh':
                    cache.refreshKey(key);
                    break;
            }
        }

        const changes = cache.captureChanges();
        const transformed = ixFrom(changes).pipe(
            ixMap(change =>
                Change.create({
                    ...change,
                    current: change.current.destination,
                    previous: change.previous?.destination,
                }),
            ),
        );

        return new ChangeSet<TDestination, TKey>(transformed);
    }

    function createTransformResult(change: Change<TSource, TKey>, container?: TransformedItemContainer) {
        return {
            success: true as const,
            container,
            key: change.key,
            change,
        };
    }

    function createTransformError(change: Change<TSource, TKey>, error: Error) {
        return {
            success: false as const,
            error,
            key: change.key,
            change,
        };
    }
}
