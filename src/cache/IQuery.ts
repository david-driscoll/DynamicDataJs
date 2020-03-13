/**
 *  Exposes internal cache state to enable querying
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export interface IQuery<TObject, TKey> {
    /**
     *  Gets the keys
     */
    keys(): IterableIterator<TKey>;

    /**
     *  Gets the Items
     */
    values(): IterableIterator<TObject>;

    /**
     *  Gets the key value pairs
     */
    entries(): IterableIterator<[TKey, TObject]>;

    /**
     * Lookup a single item using the specified key.
     * @summary Fast indexed lookup
     * @param key The key
     */
    lookup(key: TKey): TObject | undefined;

    /**
     *  The total count of cached items
     */
    readonly size: number;

    [Symbol.iterator](): IterableIterator<[TKey, TObject]>;
}
