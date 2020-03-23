import { IChangeSet } from './IChangeSet';
import { ChangeSet } from './ChangeSet';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { Change } from './Change';
import { IObservableCache } from './IObservableCache';
import { IntermediateCache } from './IntermediateCache';
import { ICacheUpdater } from './ICacheUpdater';

export type Group<TObject, TKey, TGroupKey> =
    Iterable<TObject>
    & { key: TGroupKey; cache: IObservableCache<TObject, TKey>; };

// export interface IGroupChangeSet<TObject, TKey, TGroupKey> extends IChangeSet<Group<TObject, TKey, TGroupKey>, TGroupKey> {}

export class ManagedGroup<TObject, TKey, TGroupKey> implements Group<TObject, TKey, TGroupKey> {
    private readonly _cache = new IntermediateCache<TObject, TKey>();

    constructor(public readonly key: TGroupKey) {
    }

    [Symbol.iterator]() {
        return this._cache.values();
    }

    get cache() {
        return this._cache;
    }

    /**
     * @internal
     */
    update(updateAction: (updater: ICacheUpdater<TObject, TKey>) => void) {
        this._cache.edit(updateAction);
    }

    get size() {
        return this._cache.size;
    }

    /**
     * @internal
     */
    getInitialUpdates() {
        return this._cache.getInitialUpdates();
    }
}

export class GroupChangeSet<TObject, TKey, TGroupKey> extends ChangeSet<Group<TObject, TKey, TGroupKey>, TGroupKey> implements IChangeSet<Group<TObject, TKey, TGroupKey>, TGroupKey> {
    constructor(collection?: ArrayOrIterable<Change<Group<TObject, TKey, TGroupKey>, TGroupKey>>) {
        super(collection);
    }
}