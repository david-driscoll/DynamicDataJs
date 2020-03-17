import { SortedItems } from './SortedItems';
import { IChangeSet } from './IChangeSet';
export interface ISortedChangeSet<TObject, TKey> extends IChangeSet<TObject, TKey> {
    /**
     * All cached items in sort order
     */
    readonly sortedItems: SortedItems<TObject, TKey>;
}

export type Comparer<T> = (a: T, b: T) => -1 | 0 | 1;
export type SortReason = 'initialLoad' | 'comparerChanged' | 'dataChanged' | 'reorder' | 'reset';

function keyValueComparer<TObject, TKey>(keyComparer: Comparer<TKey>, objectComparer?: Comparer<TObject>) {
    return function innerKeyValueComparer([aKey, aValue]: [TKey, TObject], [bKey, bValue]: [TKey, TObject]) {
        if (objectComparer) {
            const result = objectComparer(aValue, bValue);
            if (result !== 0) {
                return result;
            }
        }
        return keyComparer(aKey, bKey);
    };
}
