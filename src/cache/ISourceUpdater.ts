import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { EqualityComparer } from '../util/isEqualityComparer';
import { ICacheUpdater } from './ICacheUpdater';

/**
 *  Api for updating  a source cache
 *
 *  Use edit to produce singular changeset.
 *
 *  NB:The evaluate method is used to signal to any observing operators
 *  to  reevaluate whether the the object still matches downstream operators.
 *  This is primarily targeted to inline object changes such as datetime and calculated fields.
 *
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export interface ISourceUpdater<TObject, TKey> extends ICacheUpdater<TObject, TKey> {
    /**
     *  Clears existing values and loads the specified items
     * @param entries The entries.
     */
    load(entries: ArrayOrIterable<TObject>): void;

    /**
     *  Adds or changes the specified items.
     * @param entries The entries.
     */
    addOrUpdateValues(entries: ArrayOrIterable<TObject>): void;

    /**
     *  Adds or update the item,
     * @param item The item.
     */
    addOrUpdate(item: TObject): void;

    /**
     *  Adds or update the item using a comparer
     * @param item The item.
     * @param comparer The comparer
     */
    addOrUpdate(item: TObject, comparer: EqualityComparer<TObject>): void;

    /**
     *  Refreshes the specified items.
     * @param entries The entries.
     */
    refreshValues(entries: ArrayOrIterable<TObject>): void;

    /**
     * Refreshes the specified item
     * @param item The item.
     */
    refresh(): void;

    /**
     * Refreshes the specified item
     * @param item The item.
     */
    refresh(item: TObject): void;

    /**
     * Removes the specified items
     * @param entries The entries.
     */
    removeValues(entries: ArrayOrIterable<TObject>): void;

    /**
     *  Removes the specified item.
     * @param item The item.
     */
    remove(item: TObject): void;
}
