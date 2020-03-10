import { ISourceUpdater } from './ISourceUpdater';
import { ICacheUpdater } from './ICacheUpdater';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { IEqualityComparer, isEqualityComparer } from '../util/isEqualityComparer';
import { IChangeSet } from './IChangeSet';
import { ICache } from './ICache';
import { Cache } from './Cache';
import { isIterable } from '../util/isIterable';
import { iterator } from 'rxjs/internal-compatibility';

export class CacheUpdater<TObject, TKey> implements ISourceUpdater<TObject, TKey> {
    private readonly _cache: ICache<TObject, TKey>;
    private readonly _keySelector?: (obj: TObject) => TKey;

    public constructor(cache: ICache<TObject, TKey>, keySelector?: (obj: TObject) => TKey);
    //  public constructor(data: { [key: TKey]: TObject }, keySelector?: (obj: TObject) => TKey);
    public constructor(data: Map<TKey, TObject>, keySelector?: (obj: TObject) => TKey);
    // public constructor(cache: ICache<TObject, TKey>,  keySelector?: (obj: TObject) => TKey)
    // {
    //     _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    //     _keySelector = keySelector;
    // }


    public constructor(data: ICache<TObject, TKey> | Map<TKey, TObject>, keySelector?: (obj: TObject) => TKey) {
        if (data[Symbol.toStringTag] === 'Map') {
            // map
            const map = data as Map<TKey, TObject>;
            this._cache = new Cache<TObject, TKey>(map);
        } else {
            const cache = data as ICache<TObject, TKey>;
            this._cache = cache;
        }
        this._keySelector = keySelector;
    }

    public get size() {
        return this._cache.size;
    }

    public entries(): IterableIterator<[TKey, TObject]>;
    public entries(items: ArrayOrIterable<TObject>): IterableIterator<[TKey, TObject]>;
    public* entries(items?: TObject | ArrayOrIterable<TObject>, ...rest: TObject[]): IterableIterator<[TKey, TObject]> {
        if (this._keySelector == null) {
            throw new Error('A key selector must be specified');
        }
        if (Array.isArray(items)) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                yield [this._keySelector(item), item];
            }
        } else if (isIterable(items)) {
            for (const item of items) {
                yield [this._keySelector(item), item];
            }
        } else if (items) {
            yield [this._keySelector(items), items];
            for (let i = 0; i < rest.length; i++) {
                const item = rest[i];
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

    public load(entry: TObject | ArrayOrIterable<TObject>, ...rest: TObject[]) {
        this.clear();
        if (isIterable(entry)) {
            this.addOrUpdateValues(entry);
        } else {
            this.addOrUpdateValues([entry, ...rest]);
        }
    }


    public addOrUpdate(item: TObject, key: TKey): void;
    public addOrUpdate(item: TObject): void;
    public addOrUpdate(item: TObject, comparer: IEqualityComparer<TObject>): void;
    public addOrUpdate(item: TObject, comparer?: IEqualityComparer<TObject> | TKey) {
        if (this._keySelector == null) {
            throw new Error('A key selector must be specified');
        }

        if (comparer) {

            if (isEqualityComparer(comparer)) {
                const key = this._keySelector(item);
                const oldItem = this._cache.lookup(key);
                if (oldItem) {
                    if (comparer.equals(oldItem, item)) {
                        return;
                    }

                    this._cache.addOrUpdate(item, key);
                    return;
                }

            } else {
                this._cache.addOrUpdate(item, comparer);
                return;
            }

            const key = this._keySelector(item);
            this._cache.addOrUpdate(item, key);
            return;
        }

        const key = this._keySelector(item);
        this._cache.addOrUpdate(item, key);
    }

    public addOrUpdatePairs(entries: ArrayOrIterable<[TKey, TObject]>): void;
    public addOrUpdatePairs(entries: ArrayOrIterable<[TKey, TObject]>) {
        if (Array.isArray(entries)) {
            for (let i = 0; i < entries.length; i++) {
                const [key, value] = entries[i];
                this.addOrUpdate(value, key);
            }
        } else if (isIterable(entries)) {
            for (const [key, value] of entries) {
                this.addOrUpdate(value, key);
            }
        }
    }

    public refreshKeys(keys: ArrayOrIterable<TKey>): void;
    public refreshKeys(...keys: TKey[]): void;
    public refreshKeys(keys?: TKey | ArrayOrIterable<TKey>, ...rest: TKey[]) {
        if (Array.isArray(keys)) {
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                this.refreshKey(key);
            }
        } else if (isIterable(keys)) {
            for (const key of keys) {
                this.refreshKey(key);
            }
        } else if (keys) {
            this.refreshKey(keys);
            for (let i = 0; i < rest.length; i++) {
                const key = rest[i];
                this.refreshKey(key);
            }

        }
    }

    public refreshKey(key: TKey): void {
        this._cache.refreshKey(key);
    }

    public removeKeys(keys: ArrayOrIterable<TKey>): void;
    public removeKeys(...keys: TKey[]): void;
    public removeKeys(keys: TKey | ArrayOrIterable<TKey>, ...rest: TKey[]) {
        if (Array.isArray(keys)) {
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                this.removeKey(key);
            }
        } else if (isIterable(keys)) {
            for (const key of keys) {
                this.removeKey(key);
            }
        } else {
            this.removeKey(keys);
            for (let i = 0; i < rest.length; i++) {
                const key = rest[i];
                this.removeKey(key);
            }
        }
    }

    public removeKey(key: TKey): void {
        this._cache.removeKey(key);
    }

    public removePairs(entries: ArrayOrIterable<[TKey, TObject]>) {
        if (Array.isArray(entries)) {
            for (let i = 0; i < entries.length; i++) {
                const [key, value] = entries[i];
                this.remove(value);
            }
        } else if (isIterable(entries)) {
            for (const [key, value] of entries) {
                this.remove(value);
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

    public addOrUpdateValues(entries: ArrayOrIterable<TObject>): void;
    public addOrUpdateValues(...entries: TObject[]): void;
    public addOrUpdateValues(entries?: TObject | ArrayOrIterable<TObject>, ...rest: TObject[]) {
        if (Array.isArray(entries)) {
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                this.addOrUpdate(entry);
            }
        } else if (isIterable(entries)) {
            for (const entry of entries) {
                this.addOrUpdate(entry);
            }
        } else if (entries) {
            this.addOrUpdate(entries);
            for (let i = 0; i < rest.length; i++) {
                const entry = rest[i];
                this.addOrUpdate(entry);
            }
        }
    }

    public refreshValues(entries: ArrayOrIterable<TObject>): void;
    public refreshValues(...entries: TObject[]): void;
    public refreshValues(entries?: any | ArrayOrIterable<TObject>, ...rest: TObject[]) {
        if (Array.isArray(entries)) {
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                this.refresh(entry);
            }
        } else if (isIterable(entries)) {
            for (const entry of entries) {
                this.refresh(entry);
            }
        } else if (entries) {
            this.refresh(entries);
            for (let i = 0; i < rest.length; i++) {
                const entry = rest[i];
                this.refresh(entry);
            }
        }
    }

    public removeValues(entries: ArrayOrIterable<TObject>): void;
    public removeValues(...entries: TObject[]): void;
    public removeValues(entries?: TObject | ArrayOrIterable<TObject>, ...rest: TObject[]) {
        if (Array.isArray(entries)) {
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                this.remove(entry);
            }
        } else if (isIterable(entries)) {
            for (const entry of entries) {
                this.remove(entry);
            }
        } else if (entries) {
            this.remove(entries);
            for (let i = 0; i < rest.length; i++) {
                const entry = rest[i];
                this.remove(entry);
            }
        }
    }

    public getKey(item: TObject) {
        if (this._keySelector == null) {
            throw new Error('A key selector must be specified');
        }
        return this._keySelector(item);
    }

    public refresh(): void;
    public refresh(items: ArrayOrIterable<TObject>): void;
    public refresh(item: TObject): void;
    public refresh(items?: ArrayOrIterable<TObject> | TObject) {
        if (!items) {
            this._cache.refresh();
        }

        if (this._keySelector == null) {
            throw new Error('A key selector must be specified');
        }
        if (Array.isArray(items)) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                this._cache.refreshKey(this._keySelector(item));
            }
            return;
        }
        if (isIterable(items)) {
            for (const item of items) {
                this._cache.refreshKey(this._keySelector(item));
            }
            return;
        }
        this._cache.refresh();
    }

    public remove(items: ArrayOrIterable<TObject>): void;
    public remove(item: TObject): void;
    public remove(items: ArrayOrIterable<TObject> | TObject) {
        if (this._keySelector == null) {
            throw new Error('A key selector must be specified');
        }
        if (Array.isArray(items)) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                this._cache.removeKey(this._keySelector(item));
            }
            return;
        }
        if (isIterable(items)) {
            for (const item of items) {
                this._cache.removeKey(this._keySelector(item));
            }
            return;
        }

        const key = this._keySelector(items);
        this._cache.removeKey(key);
    }
}