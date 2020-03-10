import { ObservableCache } from '../ObservableCache';
import { IObservableCache } from '../IObservableCache';
import { isObservable, Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { Change } from '../Change';

class AnonymousObservableCache<TObject, TKey> implements IObservableCache<TObject, TKey> {
    private readonly _cache: IObservableCache<TObject, TKey>;
    public constructor(source: IObservableCache<TObject, TKey> | Observable<IChangeSet<TObject, TKey>>) {
        if (isObservable(source)) {
            this._cache = new ObservableCache(source);
        } else {
            this._cache = source;
        }
    }

    getKey(item: TObject): TKey {
        return this._cache.getKey(item);
    }

     get countChanged() { return this._cache.countChanged }
     get size(){ return this._cache.size }

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this._cache[Symbol.iterator]();
    }

    connect(predicate?: (obj: TObject) => boolean): Observable<IChangeSet<TObject, TKey>> {
        return this._cache.connect(predicate);
    }

    dispose(): void {
        return this._cache.dispose()
    }

    entries(): IterableIterator<[TKey, TObject]> {
        return this._cache.entries()
    }

    keys(): IterableIterator<TKey> {
        return this._cache.keys()
    }

    lookup(key: TKey): TObject | undefined {
        return this._cache.lookup(key);
    }

    preview(predicate?: (obj: TObject) => boolean): Observable<IChangeSet<TObject, TKey>> {
        return this._cache.preview(predicate)
    }

    values(): IterableIterator<TObject> {
        return this._cache.values()
    }

    watch(key: TKey): Observable<Change<TObject, TKey>> {
        return this._cache.watch(key);
    }
}

export function asObservableCache<TObject, TKey>(source: IObservableCache<TObject, TKey>): IObservableCache<TObject, TKey>
export function asObservableCache<TObject, TKey>(source: Observable<IChangeSet<TObject, TKey>>): IObservableCache<TObject, TKey>
export function asObservableCache<TObject, TKey>(source: IObservableCache<TObject, TKey>| Observable<IChangeSet<TObject, TKey>>): IObservableCache<TObject, TKey>
{
    return new AnonymousObservableCache<TObject, TKey>(source);
}
