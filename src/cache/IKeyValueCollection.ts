import { SortReason } from './ISortedChangeSet';
import { SortOptimizations } from './SortOptimizations';
import { Comparer, KeyValueComparer } from './Comparer';

/**
 *  A key collection which contains sorting information.
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface IKeyValueCollection<TObject, TKey> extends Iterable<[TKey, TObject]> {
    /**
     *  Gets the comparer used to peform the sort
     */
    readonly comparer: KeyValueComparer<TObject, TKey>;

    /**
     * The count of items.
     */
    readonly size: number;

    /**
     * Gets the reason for a sort being applied.
     */
    readonly sortReason: SortReason;

    /**
     * Gets the optimisations used to produce the sort
     */
    readonly optimizations: SortOptimizations;

    /**
     * Iterator of values in the array.
     */
    [Symbol.iterator](): IterableIterator<[TKey, TObject]>;

    /**
     * Returns an iterable of key, value pairs for every entry in the array
     */
    entries(): IterableIterator<[number, [TKey, TObject]]>;

    /**
     * Returns an iterable of keys in the array
     */
    keys(): IterableIterator<number>;

    /**
     * Returns an iterable of values in the array
     */
    values(): IterableIterator<[TKey, TObject]>;
}