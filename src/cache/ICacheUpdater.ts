import { IQuery } from './IQuery';
import { IChangeSet } from './IChangeSet';
import { ArrayOrIterable } from '../util/ArrayOrIterable';

 /**
 *  Api for updating  an intermediate cache
 *
 *  Use edit to produce singular changeset.
 *
 *  NB:The evaluate method is used to signal to any observing operators
 *  to  reevaluate whether the the object still matches downstream operators.
 *  This is primarily targeted to inline object changes such as datetime and calculated fields.
 *
  * @typeparam TObject The type of the object.
 */
export interface ICacheUpdater<TObject, TKey> extends IQuery<TObject, TKey> {
     /**
     *  Adds or updates the specified  key value pairs
     */
    addOrUpdatePairs(entries: ArrayOrIterable<[TKey, TObject]>): void;

     /**
     *  Adds or updates the specified item / key pair
     */
    addOrUpdate(item: TObject, key: TKey): void;

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
     *  Refreshes the items matching the specified keys
      * @param keys The keys.
     */
    refreshKeys(...keys: TKey[]): void;

     /**
     *  Refreshes the item matching the specified key
      * @param key The key.
     */
    refreshKey(key: TKey): void;

     /**
     * Removes the specified keys
      * @param key The key.
     */
    removeKeys(key: ArrayOrIterable<TKey>): void;

     /**
     *  RRemoves the specified keys
      * @param keys The keys.
     */
    removeKeys(...keys: TKey[]): void;

     /**
     * Remove the specified key
      * @param key The key.
     */
    removeKey(key: TKey): void;

     /**
     *  Removes the specified  key value pairs
      * @param entries The entries.
     */
    removePairs(entries: ArrayOrIterable<[TKey, TObject]>): void;

     /**
     *  Clones the change set to the cache
     */
    clone(changes: IChangeSet<TObject, TKey>): void;

     /**
     *  Clears all items from the underlying cache.
     */
    clear(): void;

     /**
     *  Gets the key associated with the object
      * @param item The item.
     */
    getKey(item: TObject): TKey;

     /**
     *  Gets the key values for the specified items
      * @param values The values.
     */
    entries(values: ArrayOrIterable<TObject>): IterableIterator<[TKey, TObject]>;

     /**
     *  Gets the key values for the specified items
      * @param values The values.
     */
    entries(...values: TObject[]): IterableIterator<[TKey, TObject]>;
}