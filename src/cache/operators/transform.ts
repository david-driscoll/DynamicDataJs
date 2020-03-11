import { OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { map, scan } from 'rxjs/operators';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { notEmpty } from './notEmpty';

export type DynamicDataError<TObject, TKey> = { key: TKey; value: TObject; error: Error };

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
    exceptionCallback?: (error: DynamicDataError<TObject, TKey>) => void,
): OperatorFunction<IChangeSet<TObject, TKey>, IChangeSet<TDestination, TKey>> {
    return function transformOperator(source) {
        return source.pipe(
            scan((cache, changes) => {
                for (let change of changes) {
                    switch (change.reason) {
                        case 'add':
                        case 'update': {
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
                        case 'refresh': {
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
            notEmpty(),
        );
    };
}