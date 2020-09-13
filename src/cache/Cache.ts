import { ICache } from './ICache';
import { IChangeSet } from './IChangeSet';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { isIterable } from '../util/isIterable';
import { deepEqualMapAdapter } from '../util/deepEqualMapAdapter';

export class Cache<TObject, TKey> implements ICache<TObject, TKey> {
    private readonly _data: Map<TKey, TObject>;
    private readonly _deepEqual: boolean;
    private readonly _mapAdapter: {
        get: typeof Map.prototype.get;
        set: typeof Map.prototype.set;
        has: typeof Map.prototype.has;
        delete: typeof Map.prototype.delete;
    };

    public get size() {
        return this._data.size;
    }

    public entries() {
        return this._data.entries();
    }

    public values() {
        return this._data.values();
    }

    public keys() {
        return this._data.keys();
    }

    public static empty<TObject, TKey>() {
        return new Cache<TObject, TKey>();
    }

    public constructor(deepEqual: boolean);
    public constructor(data?: Map<TKey, TObject>, deepEqual?: boolean);
    public constructor(data?: Map<TKey, TObject> | boolean, deepEqual = false) {
        if (typeof data === 'boolean') {
            this._data = new Map<TKey, TObject>();
            deepEqual = data;
        } else {
            this._data = data ?? new Map<TKey, TObject>();
        }
        this._deepEqual = deepEqual;
        this._mapAdapter = deepEqual ? deepEqualMapAdapter(this._data) : this._data;
    }

    public clone(): void;
    public clone(changes: IChangeSet<TObject, TKey>): void;
    public clone(changes?: IChangeSet<TObject, TKey>) {
        if (changes === undefined) {
            return;
        }

        for (const item of changes) {
            switch (item.reason) {
                case 'update':
                case 'add':
                    {
                        this._mapAdapter.set(item.key, item.current);
                    }

                    break;
                case 'remove':
                    this._mapAdapter.delete(item.key);
                    break;
            }
        }
    }

    public lookup(key: TKey): TObject | undefined {
        return this._mapAdapter.get(key);
    }

    public addOrUpdate(item: TObject, key: TKey) {
        this._mapAdapter.set(key, item);
    }

    public removeKeys(keys: ArrayOrIterable<TKey>) {
        if (Array.isArray(keys)) {
            for (const key of keys) {
                if (this._mapAdapter.has(key)) {
                    this._mapAdapter.delete(key);
                }
            }
        } else if (isIterable(keys)) {
            for (const key of keys) {
                if (this._mapAdapter.has(key)) {
                    this._mapAdapter.delete(key);
                }
            }
        }
    }

    public removeKey(key: TKey) {
        if (this._mapAdapter.has(key)) {
            this._mapAdapter.delete(key);
        }
    }

    public clear() {
        this._data.clear();
    }

    public refresh() {
        //?
    }

    public refreshKeys(keys: ArrayOrIterable<TKey>) {
        //?
    }

    public refreshKey(key: TKey) {
        //?
    }

    readonly [Symbol.toStringTag] = 'Cache' as const;

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this.entries();
    }
}
