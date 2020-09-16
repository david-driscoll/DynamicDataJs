import { KeyValueComparer } from './Comparer';
import { SortOptimizations } from './SortOptimizations';
import { ChangeAwareCache } from './ChangeAwareCache';
import { IChangeSet } from './IChangeSet';
import { from, toArray } from 'ix/iterable';
import { orderBy, orderByDescending } from 'ix/iterable/operators';
import { Change } from './Change';
import { ChangeSet } from './ChangeSet';
import bs from 'binary-search';
import { comparer } from 'ix/util/comparer';

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
        const initialItems = this._list.map(([key, value], index) => Change.add(key, value, index));
        return new ChangeSet<TObject, TKey>(initialItems);
    }

    public reset(cache: ChangeAwareCache<TObject, TKey>) {
        this._list = toArray(from(cache.entries()).pipe(orderBy(z => z, this._comparer)));
        // cache.clone(this._list)
        return this.reorder();
    }

    public changeComparer(comparer: KeyValueComparer<TObject, TKey>): IChangeSet<TObject, TKey> {
        this._comparer = comparer;
        return ChangeSet.empty<TObject, TKey>();
    }

    public reorder(): IChangeSet<TObject, TKey> {
        // if (this._optimisations.HasFlag(SortOptimisations.IgnoreEvaluates))
        // {
        // //reorder entire sequence and do not calculate moves
        // this._list = toArray(from(this._list).pipe(orderBy(z => z, this._comparer)));
        // }
        // else
        // {
        // }
        const changes: Change<TObject, TKey>[] = [];
        let index = -1;
        const sorted = toArray(from(this._list).pipe(orderBy(t => t, this._comparer)));
        for (const current of sorted) {
            const [currentKey, currentValue] = current;
            index++;

            //Cannot use binary search as Resort is implicit of a mutable change
            const [existingKey, existingValue] = this._list[index];
            const areequal = comparer(currentKey, existingKey);
            if (areequal) {
                continue;
            }

            const old = this._list.indexOf(current);
            this._list.splice(old, 1);
            this._list.splice(index, 0, current);

            changes.push(Change.moved(currentKey, currentValue, index, old));
        }
        return new ChangeSet<TObject, TKey>(changes);
    }

    public calculate(changes: IChangeSet<TObject, TKey>): IChangeSet<TObject, TKey> {
        const result: Change<TObject, TKey>[] = [];
        const refreshes: Change<TObject, TKey>[] = [];

        for (const u of changes) {
            const current: [TKey, TObject] = [u.key, u.current];

            switch (u.reason) {
                case 'add':
                    {
                        const position = this.getInsertPositionBinary(current);
                        this._list.splice(position, 0, current);

                        result.push(Change.add(u.key, u.current, position));
                    }

                    break;

                case 'update':
                    {
                        const old = this.getCurrentPosition([u.key, u.previous!]);
                        this._list.splice(old, 1);

                        const newposition = this.getInsertPositionBinary(current);
                        this._list.splice(newposition, 0, current);

                        result.push(Change.update(u.key, u.current, u.previous!, newposition, old));
                    }

                    break;

                case 'remove':
                    {
                        const position = this.getCurrentPosition(current);
                        this._list.splice(position, 1);
                        result.push(Change.remove(u.key, u.current, position));
                    }

                    break;

                case 'refresh':
                    {
                        refreshes.push(u);
                        result.push(u);
                    }

                    break;
            }
        }

        //for evaluates, check whether the change forces a new position
        // if (evaluates.Count != 0 && _optimisations.HasFlag(SortOptimisations.IgnoreEvaluates))
        // {
        //     //reorder entire sequence and do not calculate moves
        //     _list = _list.OrderBy(kv => kv, _comparer).ToList();
        // }
        // else
        // {
        // }

        const evaluates = toArray(from(refreshes).pipe(orderByDescending(x => [x.key, x.current] as const, this._comparer)));
        //calculate moves.  Very expensive operation
        //TODO: Try and make this better
        for (const current of evaluates) {
            const currentTuple = [current.key, current.current] as const;
            const old = this._list.findIndex(([k, v]) => k === current.key && v === current.current);
            if (old == -1) {
                continue;
            }

            let newposition = this.getInsertPositionLinear(this._list, currentTuple);

            if (old < newposition) {
                newposition--;
            }

            if (old == newposition) {
                continue;
            }

            this._list.splice(old, 1);
            this._list.splice(newposition, 0, currentTuple as [TKey, TObject]);
            result.push(Change.moved(current.key, current.current, newposition, old));
        }

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
        for (const [i, element] of list.entries()) {
            if (this._comparer(item, element) < 0) {
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
