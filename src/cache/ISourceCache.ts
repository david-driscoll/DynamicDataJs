import { IObservableCache } from './IObservableCache';
import { ISourceUpdater } from './ISourceUpdater';

/**
 * An observable cache which exposes an update API.  Used at the root
 * of all observable chains
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface ISourceCache<TObject, TKey> extends IObservableCache<TObject, TKey> {
    /**
     * Action to apply a batch update to a cache. Multiple update methods can be invoked within a single batch operation.
     * These operations are invoked within the cache's lock and is therefore thread safe.
     * The result of the action will produce a single changeset
     * @param updateAction The update action
     */
    edit(updateAction: (updater: ISourceUpdater<TObject, TKey>) => void): void;
}

export function isSourceCache(value: any): value is ISourceCache<any, any> {
    return value && value[Symbol.toStringTag] === 'ObservableCache' && value.edit !== undefined;
}
