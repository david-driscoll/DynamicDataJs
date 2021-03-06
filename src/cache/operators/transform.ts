import { map, scan } from 'rxjs/operators';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { notEmpty } from './notEmpty';
import { ChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';
import { DynamicDataError } from '../DynamicDataError';

/**
 * Projects each update item to a new form using the specified transform function
 * @category Operator
 * @typeparam TDestination The type of the destination.
 * @typeparam TSource The type of the source.
 * @typeparam TKey The type of the key.
 * @param transformFactory The transform factory.
 * @param transformOnRefresh Should a new transform be applied when a refresh event is received
 * @param exceptionCallback callback when exceptions happen
 */
export function transform<TSource, TKey, TDestination>(
    transformFactory: (current: TSource, key: TKey, previous: TSource | undefined) => TDestination,
    transformOnRefresh: boolean = true,
    exceptionCallback?: (error: DynamicDataError<TSource, TKey>) => void,
): ChangeSetOperatorFunction<TSource, TKey, TDestination> {
    return function transformOperator(source) {
        return source.pipe(
            scan((cache, changes) => {
                for (const change of changes) {
                    switch (change.reason) {
                        case 'add':
                        case 'update':
                            {
                                let transformed: TDestination;
                                if (exceptionCallback != undefined) {
                                    try {
                                        transformed = transformFactory(change.current, change.key, change.previous);
                                        cache.addOrUpdate(transformed, change.key);
                                    } catch (error) {
                                        exceptionCallback({ error: error, key: change.key, value: change.current });
                                    }
                                } else {
                                    transformed = transformFactory(change.current, change.key, change.previous);
                                    cache.addOrUpdate(transformed, change.key);
                                }
                            }
                            break;
                        case 'remove':
                            cache.removeKey(change.key);
                            break;
                        case 'refresh':
                            {
                                if (transformOnRefresh) {
                                    const transformed = transformFactory(change.current, change.key, change.previous);
                                    cache.addOrUpdate(transformed, change.key);
                                } else {
                                    cache.refreshKey(change.key);
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
            notEmpty(),
        );
    };
}
