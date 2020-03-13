import { ICacheUpdater } from './ICacheUpdater';
import { IObservableCache } from './IObservableCache';
/**
 * An observable cache which exposes an update API.
 *
 * Intended to be used as a helper for creating custom operators.
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface IIntermediateCache<TObject, TKey> extends IObservableCache<TObject, TKey> {
    /**
     * Action to apply a batch update to a cache. Multiple update methods can be invoked within a single batch operation.
     * These operations are invoked within the cache's lock and is therefore thread safe.
     * The result of the action will produce a single changeset
     * @param updateAction The update action
     */
    edit(updateAction: (updater: ICacheUpdater<TObject, TKey>) => void): void;
}
