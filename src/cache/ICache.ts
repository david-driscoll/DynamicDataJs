import { IQuery } from './IQuery';
import { IChangeSet } from './IChangeSet';
import { ArrayOrIterable } from '../util/ArrayOrIterable';

/**
 *  A cache which captures all changes which are made to it. These changes are recorded until CaptureChanges() at which point thw changes are cleared.
 *
 *  Used for creating custom operators
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export interface ICache<TObject, TKey> extends IQuery<TObject, TKey> {
    /**
     *  Clones the cache from the specified changes
     * @param changes The changes.
     */
    clone(changes: IChangeSet<TObject, TKey>): void;

    /**
     *  Adds or updates the item using the specified key
     * @param item The item.
     * @param key The key.
     */
    addOrUpdate(item: TObject, key: TKey): void;

    /**
     *  Removes the item matching the specified key.
     * @param key The key.
     */
    removeKey(key: TKey): void;

    /**
     *  Removes all items matching the specified keys
     * @param keys The keys.
     */
    removeKeys(keys: ArrayOrIterable<TKey>): void;

    /**
     *  Clears all items
     */
    clear(): void;

    /**
     *  Sends a signal for operators to recalculate it's state
     */
    refresh(): void;

    /**
     *  Refreshes the items matching the specified keys
     * @param keys The keys.
     */
    refreshKeys(keys: ArrayOrIterable<TKey>): void;

    /**
     *  Refreshes the item matching the specified key
     */
    refreshKey(key: TKey): void;

    /**
     * The tag of this class, should return `Cache`
     */
    readonly [Symbol.toStringTag]: 'Cache';
}