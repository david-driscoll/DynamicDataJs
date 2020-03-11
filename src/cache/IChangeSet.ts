import { Change } from './Change';

/**
 * A collection of changes.
 *
 * Changes are always published in the order.
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface IChangeSet<TObject, TKey> {
    /**
     *     Gets the number of additions
     */
    readonly adds: number;

    /**
     *     Gets the number of removes
     */
    readonly removes: number;

    /**
     * The number of refreshes
     */
    readonly refreshes: number;

    /**
     *     Gets the number of moves
     */
    readonly moves: number;

    /**
     *     The total update count
     */
    readonly size: number;

    /**
     * The number of updates
     */
    readonly updates: number;

    /** Iterator of values in the changeset. */
    [Symbol.iterator](): IterableIterator<Change<TObject, TKey>>;

    /**
     * Returns an iterable of key, value pairs for every entry in the changeset
     */
    values(): IterableIterator<Change<TObject, TKey>>;

    /**
     * foreach item in the changeset
     * @param callbackfn
     * @param thisArg
     */
    forEach(callbackfn: (value: Change<TObject, TKey>) => void, thisArg?: any): void;
}