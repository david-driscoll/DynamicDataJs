import { IQuery } from './IQuery';
import { Cache } from './Cache';

export class AnonymousQuery<TObject, TKey> implements IQuery<TObject, TKey> {
    private readonly _cache: Cache<TObject, TKey>;

    public constructor(cache: Cache<TObject, TKey>) {
        this._cache = cache;
    }

    get size() {
        return this._cache.size;
    }

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this._cache[Symbol.iterator]();
    }

    entries(): IterableIterator<[TKey, TObject]> {
        return this._cache.entries();
    }

    keys(): IterableIterator<TKey> {
        return this._cache.keys();
    }

    lookup(key: TKey): TObject | undefined {
        return this._cache.lookup(key);
    }

    values(): IterableIterator<TObject> {
        return this._cache.values();
    }
}