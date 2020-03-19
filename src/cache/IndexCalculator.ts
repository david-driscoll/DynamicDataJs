import { KeyValueComparer } from './Comparer';
import { SortOptimizations } from './SortOptimizations';
import { ChangeAwareCache } from './ChangeAwareCache';
import { IChangeSet } from './IChangeSet';
import { from, toArray } from 'ix/iterable';
import { orderBy } from 'ix/iterable/operators';
import { Change } from './Change';
import { ChangeSet } from './ChangeSet';
import bs from 'binary-search';

export class IndexCalculator<TObject, TKey> {
    private _comparer: KeyValueComparer<TObject, TKey>;
    private _list: Array<[TKey, TObject]>;
    private readonly _optimisations: SortOptimizations;

    public constructor(comparer: KeyValueComparer<TObject, TKey>, optimizations: SortOptimizations) {
        this._comparer = comparer;
        this._optimisations = optimizations;
        this._list = [];
    }

    public load(cache: ChangeAwareCache<TObject, TKey>): IChangeSet<TObject, TKey> {
        //for the first batch of changes may have arrived before the comparer was set.
        //therefore infer the first batch of changes from the cache

        this._list = toArray(from(cache.entries()).pipe(orderBy(z => z, this._comparer)));
        const initialItems = this._list.map(([key, value], index) => new Change<TObject, TKey>('add', key, value, index));
        return new ChangeSet<TObject, TKey>(initialItems);
    }

    public reset(cache: ChangeAwareCache<TObject, TKey>) {
        this._list = toArray(from(cache.entries()).pipe(orderBy(z => z, this._comparer)));
    }

    public changeComparer(comparer: KeyValueComparer<TObject, TKey>): IChangeSet<TObject, TKey> {
        this._comparer = comparer;
        return ChangeSet.empty<TObject, TKey>();
    }

    public reorder(): IChangeSet<TObject, TKey> {
        // if (this._optimisations.HasFlag(SortOptimisations.IgnoreEvaluates))
        // {
        //reorder entire sequence and do not calculate moves
        // }
        // else
        // {
        //     int index = -1;
        //     var sorted = _list.OrderBy(t => t, _comparer).ToList();
        //     foreach (var item in sorted)
        //     {
        //         KeyValuePair<TKey, TObject> current = item;
        //         index++;
        //
        //         //Cannot use binary search as Resort is implicit of a mutable change
        //         KeyValuePair<TKey, TObject> existing = _list[index];
        //         var areequal = EqualityComparer<TKey>.Default.Equals(current.Key, existing.Key);
        //         if (areequal)
        //         {
        //             continue;
        //         }
        //
        //         var old = _list.IndexOf(current);
        //         _list.RemoveAt(old);
        //         _list.Insert(index, current);
        //
        //         result.Add(new Change<TObject, TKey>(current.Key, current.Value, index, old));
        //     }
        // }
        // TODO: Support optimizations properly
        this._list = toArray(from(this._list).pipe(orderBy(z => z, this._comparer)));
        return new ChangeSet<TObject, TKey>([]);
    }

    public calculate(changes: IChangeSet<TObject, TKey>): IChangeSet<TObject, TKey> {
        const result: Change<TObject, TKey>[] = [];
        const refreshes: Change<TObject, TKey>[] = [];

        for (const u of changes) {
            const current: [TKey, TObject] = [u.key, u.current];

            switch (u.reason) {
                case 'add': {
                    const position = this.getInsertPositionBinary(current);
                    this._list.splice(position, 0, current);

                    result.push(new Change<TObject, TKey>('add', u.key, u.current, position));
                }

                    break;

                case 'update': {
                    const old = this.getCurrentPosition([u.key, u.previous!]);
                    this._list.splice(old, 1);

                    const newposition = this.getInsertPositionBinary(current);
                    this._list.splice(newposition, 0, current);

                    result.push(new Change<TObject, TKey>('update',
                        u.key,
                        u.current, u.previous, newposition, old));
                }

                    break;

                case 'remove': {
                    const position = this.getCurrentPosition(current);
                    this._list.splice(position, 1);
                    result.push(new Change<TObject, TKey>('remove', u.key, u.current, position));
                }

                    break;

                case 'refresh': {
                    refreshes.push(u);
                    result.push(u);
                }

                    break;
            }
        }


        // TODO: Support optimizations properly
        this._list = toArray(from(this._list).pipe(orderBy(z => z, this._comparer)));

        //for evaluates, check whether the change forces a new position
//    var evaluates = toArray(from(refreshes).pipe(orderByDescending(x => [x.key, x.current] as const , this._comparer)));
        // if (evaluates.Count != 0 && _optimisations.HasFlag(SortOptimisations.IgnoreEvaluates))
        // {
        //     //reorder entire sequence and do not calculate moves
        //     _list = _list.OrderBy(kv => kv, _comparer).ToList();
        // }
        // else
        // {
        //     //calculate moves.  Very expensive operation
        //     //TODO: Try and make this better
        //     foreach (var u in evaluates)
        //     {
        //         var current = new KeyValuePair<TKey, TObject>(u.Key, u.Current);
        //         var old = _list.IndexOf(current);
        //         if (old == -1)
        //         {
        //             continue;
        //         }
        //
        //         int newposition = GetInsertPositionLinear(_list, current);
        //
        //         if (old < newposition)
        //         {
        //             newposition--;
        //         }
        //
        //         if (old == newposition)
        //         {
        //             continue;
        //         }
        //
        //         _list.RemoveAt(old);
        //         _list.Insert(newposition, current);
        //         result.Add(new Change<TObject, TKey>(u.Key, u.Current, newposition, old));
        //     }
        // }

        return new ChangeSet<TObject, TKey>(result);
    }

    public get comparer() {
        return this._comparer;
    }

    public get list() {
        return this._list as ReadonlyArray<[TKey, TObject]>;
    }

    private getCurrentPosition(item: readonly [TKey, TObject]): number {
        // if (this._optimisations.HasFlag(SortOptimisations.ComparesImmutableValuesOnly))
        // {
        //     index = _list.BinarySearch(item, _comparer);
        //
        //     if (index < 0)
        //     {
        //         throw new SortException("Current position cannot be found.  Ensure the comparer includes a unique value, or do not specify ComparesImmutableValuesOnly");
        //     }
        // }
        // else
        // {
        // }

        const index = this._list.findIndex(z => z[0] === item[0] && z[1] === item[1]);
        if (index < 0) {
            throw new Error('Current position cannot be found. The item is not in the collection');
        }
        return index;
    }

    private getInsertPositionLinear(list: readonly [TKey, TObject][], item: readonly [TKey, TObject]): number {
        for (let i = 0; i < list.length; i++) {
            if (this._comparer(item, list[i]) < 0) {
                return i;
            }
        }

        return this._list.length;
    }

    private getInsertPositionBinary(item: readonly [TKey, TObject]): number {
        let index: number = bs(this._list, item, this._comparer);

        if (index > 0) {
            const indx = index;
            index = bs(this._list, item, this._comparer, indx - 1, this._list.length - indx);
            if (index > 0) {
                return indx;
            }
        }

        const insertIndex = ~index;
        return insertIndex;
    }
}