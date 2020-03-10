import { ICache } from './ICache';
import { IChangeSet } from './IChangeSet';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { isIterable } from '../util/isIterable';

export class Cache<TObject, TKey> implements ICache<TObject, TKey> {
    private readonly _data: Map<TKey, TObject>;

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

    public constructor(data?: Map<TKey, TObject>) {
        this._data = data ?? new Map<TKey, TObject>();
    }

    public clone(): void;
    public clone(changes: IChangeSet<TObject, TKey>): void;
    public clone(changes?: IChangeSet<TObject, TKey>) {
        if (changes === undefined) {
            return new Cache<TObject, TKey>(new Map<TKey, TObject>(this._data));
        }

        for (const item of changes) {
            switch (item.reason) {
                case 'update':
                case 'add': {
                    this._data.set(item.key, item.current);
                }

                    break;
                case 'remove':
                    this._data.delete(item.key);
                    break;
            }
        }
    }

    public lookup(key: TKey): TObject | undefined {
        return this._data.get(key);
    }

    public addOrUpdate(item: TObject, key: TKey) {
        this._data.set(key, item);
    }

    public removeKeys(keys: ArrayOrIterable<TKey>): void;
    public removeKeys(...keys: TKey[]): void;
    public removeKeys(keys: TKey | ArrayOrIterable<TKey>, ...rest: TKey[]) {
        if (Array.isArray(keys)) {
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (this._data.has(key)) {
                    this._data.delete(key);
                }
            }
        } else if (isIterable(keys)) {
            for (const key of keys) {
                if (this._data.has(key)) {
                    this._data.delete(key);
                }
            }
        } else {
            if (this._data.has(keys)) {
                this._data.delete(keys);
            }
            for (let i = 0; i < rest.length; i++) {
                const key = rest[i];
                if (this._data.has(key)) {
                    this._data.delete(key);
                }
            }
        }
    }

    public removeKey(key: TKey) {
        return this.removeKeys(key);
    }

    public clear() {
        this._data.clear();
    }

    public refresh() {
    }

    public refreshKeys(keys: ArrayOrIterable<TKey>): void;
    public refreshKeys(...keys: TKey[]): void;
    public refreshKeys(...keys: any[]) {

    }

    public refreshKey(key: TKey) {
    }

    [Symbol.toStringTag]: 'Cache';

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this.entries();
    }
}