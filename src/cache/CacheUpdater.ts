import { ISourceUpdater } from './ISourceUpdater';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { EqualityComparer, isEqualityComparer } from '../util/isEqualityComparer';
import { IChangeSet } from './IChangeSet';
import { ICache } from './ICache';
import { Cache } from './Cache';
import { isIterable } from '../util/isIterable';
import { isMap } from '../util/isMap';

export class CacheUpdater<TObject, TKey> implements ISourceUpdater<TObject, TKey> {
    private readonly _cache: ICache<TObject, TKey>;
    private readonly _keySelector?: (object: TObject) => TKey;

    public constructor(cache: ICache<TObject, TKey>, keySelector?: (object: TObject) => TKey);
    public constructor(data: Map<TKey, TObject>, keySelector?: (object: TObject) => TKey, deepEqual?: boolean);
    public constructor(data: ICache<TObject, TKey> | Map<TKey, TObject>, keySelector?: (object: TObject) => TKey, deepEqual = false) {
        if (isMap(data)) {
            // map
            this._cache = new Cache<TObject, TKey>(data, deepEqual);
        } else {
            this._cache = data;
        }
        this._keySelector = keySelector;
    }

    public get size() {
        return this._cache.size;
    }

    public *entries(items: ArrayOrIterable<TObject>): IterableIterator<[TKey, TObject]> {
        if (this._keySelector == undefined) {
            throw new Error('A key selector must be specified');
        }
        if (Array.isArray(items)) {
            for (const item of items) {
                yield [this._keySelector(item), item];
            }
        } else if (isIterable(items)) {
            for (const item of items) {
                yield [this._keySelector(item), item];
            }
        }
    }

    public values() {
        return this._cache.values();
    }

    public keys() {
        return this._cache.keys();
    }

    public lookup(key: TKey) {
        return this._cache.lookup(key);
    }

    public load(entry: ArrayOrIterable<TObject>) {
        this.clear();
        this.addOrUpdateValues(entry);
    }

    public addOrUpdate(item: TObject, key: TKey): void;
    public addOrUpdate(item: TObject): void;
    public addOrUpdate(item: TObject, comparer: EqualityComparer<TObject>): void;
    public addOrUpdate(item: TObject, comparer?: EqualityComparer<TObject> | TKey) {
        if (this._keySelector == undefined && (!comparer || typeof comparer === 'function')) {
            throw new Error('A key selector must be specified');
        }

        if (comparer) {
            if (isEqualityComparer(comparer)) {
                const key = this._keySelector!(item);
                const oldItem = this._cache.lookup(key);
                if (oldItem !== undefined) {
                    if (comparer(oldItem, item)) {
                        return;
                    }

                    this._cache.addOrUpdate(item, key);
                    return;
                }
            } else {
                this._cache.addOrUpdate(item, comparer);
                return;
            }

            const key = this._keySelector!(item);
            this._cache.addOrUpdate(item, key);
            return;
        }

        const key = this._keySelector!(item);
        this._cache.addOrUpdate(item, key);
    }

    public addOrUpdatePairs(entries: ArrayOrIterable<[TKey, TObject]>): void;
    public addOrUpdatePairs(entries: ArrayOrIterable<[TKey, TObject]>) {
        if (Array.isArray(entries)) {
            for (const [key, value] of entries) {
                this.addOrUpdate(value, key);
            }
        } else if (isIterable(entries)) {
            for (const [key, value] of entries) {
                this.addOrUpdate(value, key);
            }
        }
    }

    public refreshKeys(keys: ArrayOrIterable<TKey>) {
        if (Array.isArray(keys)) {
            for (const key of keys) {
                this.refreshKey(key);
            }
        } else if (isIterable(keys)) {
            for (const key of keys) {
                this.refreshKey(key);
            }
        }
    }

    public refreshKey(key: TKey): void {
        this._cache.refreshKey(key);
    }

    public removeKeys(keys: ArrayOrIterable<TKey>) {
        if (Array.isArray(keys)) {
            for (const key of keys) {
                this.removeKey(key);
            }
        } else if (isIterable(keys)) {
            for (const key of keys) {
                this.removeKey(key);
            }
        }
    }

    public removeKey(key: TKey): void {
        this._cache.removeKey(key);
    }

    public removePairs(entries: ArrayOrIterable<[TKey, TObject]>) {
        if (Array.isArray(entries)) {
            for (const [key] of entries) {
                this.removeKey(key);
            }
        } else if (isIterable(entries)) {
            for (const [key] of entries) {
                this.removeKey(key);
            }
        }
    }

    public clone(changes: IChangeSet<TObject, TKey>): void {
        this._cache.clone(changes);
    }

    public clear(): void {
        this._cache.clear();
    }

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this._cache[Symbol.iterator]();
    }

    public addOrUpdateValues(entries: ArrayOrIterable<TObject>) {
        if (Array.isArray(entries)) {
            for (const entry of entries) {
                this.addOrUpdate(entry);
            }
        } else if (isIterable(entries)) {
            for (const entry of entries) {
                this.addOrUpdate(entry);
            }
        }
    }

    public refreshValues(entries: ArrayOrIterable<TObject>) {
        if (this._keySelector == undefined) {
            throw new Error('A key selector must be specified');
        }
        if (Array.isArray(entries)) {
            for (const entry of entries) {
                this.refreshKey(this._keySelector(entry));
            }
        } else if (isIterable(entries)) {
            for (const entry of entries) {
                this.refreshKey(this._keySelector(entry));
            }
        }
    }

    public removeValues(entries: ArrayOrIterable<TObject>) {
        if (this._keySelector == undefined) {
            throw new Error('A key selector must be specified');
        }
        if (Array.isArray(entries)) {
            for (const entry of entries) {
                this.removeKey(this._keySelector(entry));
            }
        } else if (isIterable(entries)) {
            for (const entry of entries) {
                this.removeKey(this._keySelector(entry));
            }
        }
    }

    public getKey(item: TObject) {
        if (this._keySelector == undefined) {
            throw new Error('A key selector must be specified');
        }
        return this._keySelector(item);
    }

    public refresh() {
        this._cache.refresh();
    }

    public remove(value: TObject) {
        if (this._keySelector == undefined) {
            throw new Error('A key selector must be specified');
        }
        this.removeKey(this._keySelector(value));
    }
}
