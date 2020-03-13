import { PageResponse } from './PageResponse';
import { ISortedChangeSet } from './ISortedChangeSet';
export interface IPagedChangeSet<TObject, TKey> extends ISortedChangeSet<TObject, TKey> {
    /**
     * The parameters used to virtualize the stream
     */
    readonly response: PageResponse;
}
