import { SortedItems } from './SortedItems';
import { IChangeSet } from './IChangeSet';
export interface ISortedChangeSet<TObject, TKey> extends IChangeSet<TObject, TKey> {
    /**
     * All cached items in sort order
     */
    readonly sortedItems: SortedItems<TObject, TKey>;
}

export type Comparer<T> = (a: T, b: T) => -1 | 0 | 1;
