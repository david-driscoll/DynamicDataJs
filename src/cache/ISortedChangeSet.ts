import { IChangeSet } from './IChangeSet';
import { IKeyValueCollection } from './IKeyValueCollection';

export interface ISortedChangeSet<TObject, TKey> extends IChangeSet<TObject, TKey> {
    /**
     * All cached items in sort order
     */
    readonly sortedItems: IKeyValueCollection<TObject, TKey>;
}

export type SortReason = 'initialLoad' | 'comparerChanged' | 'dataChanged' | 'reorder' | 'reset';

export function isSortedChangeSet<TObject, TKey>(changeSet: IChangeSet<TObject, TKey>): changeSet is ISortedChangeSet<TObject, TKey> {
    return !!(changeSet as any).sortedItems;
}
