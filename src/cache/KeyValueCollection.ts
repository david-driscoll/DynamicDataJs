import { IKeyValueCollection } from './IKeyValueCollection';
import { SortOptimizations } from './SortOptimizations';
import { count } from 'ix/iterable';
import { Comparer, KeyValueComparer, keyValueComparer } from './Comparer';
import { SortReason } from './ISortedChangeSet';

export class KeyValueCollection<TObject, TKey> implements IKeyValueCollection<TObject, TKey> {
    private readonly _items: ReadonlyArray<[TKey, TObject]>;

    public constructor();
    public constructor(
        items: ReadonlyArray<[TKey, TObject]>,
        comparer: KeyValueComparer<TObject, TKey>,
        sortReason: SortReason,
        optimizations: SortOptimizations);
    public constructor(
        items?: ReadonlyArray<[TKey, TObject]>,
        comparer?: KeyValueComparer<TObject, TKey>,
        sortReason?: SortReason,
        optimizations?: SortOptimizations) {
        if (items === undefined) {
            this._items = [];
            this.size = 0;
            this.sortReason = 'reset';
            this.optimizations = 'none';
            this.comparer = keyValueComparer((a, b) => {
                if ((<any>a)?.valueOf() > (<any>b)?.valueOf()) {
                    return 1;
                }
                if ((<any>a)?.valueOf() < (<any>a)?.valueOf()) {
                    return -1;
                }
                return 0;
            });
        } else {
            this._items = items;
            this.size = count(items);
            this.comparer = comparer!;
            this.sortReason = sortReason!;
            this.optimizations = optimizations!;
        }
    }

    /**
     * Gets the comparer used to peform the sort
     */
    public readonly comparer: Comparer<[TKey, TObject]>;

    public readonly size: number;

    public sortReason: SortReason;

    public readonly optimizations: SortOptimizations;

    [Symbol.iterator]() {
        return this._items[Symbol.iterator]();
    }

    entries() {
        return this._items.entries();
    }

    keys() {
        return this._items.keys();
    }

    values() {
        return this._items.values();
    };
}