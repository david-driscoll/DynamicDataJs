import { ChangeSet } from './ChangeSet';
import { IKeyValueCollection } from './IKeyValueCollection';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { Change } from './Change';
import { KeyValueCollection } from './KeyValueCollection';

export class SortedChangeSet<TObject, TKey> extends ChangeSet<TObject, TKey> {
    public readonly sortedItems: IKeyValueCollection<TObject, TKey>;

    constructor(sortedItems?: IKeyValueCollection<TObject, TKey>, collection?: ArrayOrIterable<Change<TObject, TKey>>) {
        super(collection);
        this.sortedItems = sortedItems ?? new KeyValueCollection<TObject, TKey>();
    }
}