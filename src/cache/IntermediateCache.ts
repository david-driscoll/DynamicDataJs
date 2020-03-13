import { ICacheUpdater } from './ICacheUpdater';
import { ObservableCache } from './ObservableCache';
import { Observable } from 'rxjs';
import { IChangeSet } from './IChangeSet';
import { IIntermediateCache } from './IIntermediateCache';
/**
 *  Cache designed to be used for custom operator construction. It requires no key to be specified
 *  but instead relies on the user specifying the key when amending data
 *
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export class IntermediateCache<TObject, TKey> implements IIntermediateCache<TObject, TKey> {
    private readonly _innerCache: ObservableCache<TObject, TKey>;
    /**
     *  Initializes a new instance of the <see cref="IntermediateCache{TObject, TKey}"/> class.
     *
     * @param source The source.
     */
    public constructor(source?: Observable<IChangeSet<TObject, TKey>>) {
        this._innerCache = new ObservableCache<TObject, TKey>(source);
    }
    public getKey(item: TObject): TKey {
        return this._innerCache.getKey(item);
    }
    [Symbol.toStringTag] = 'ObservableCache' as const;
    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        throw new Error('Method not implemented.');
    }
    /**
     *  Action to apply a batch update to a cache. Multiple update methods can be invoked within a single batch operation.
     *  These operations are invoked within the cache's lock and is therefore thread safe.
     *  The result of the action will produce a single changeset
     *
     * @param updateAction The update action.
     *
     */
    public edit(updateAction: (updater: ICacheUpdater<TObject, TKey>) => void) {
        this._innerCache.updateFromIntermediate(updateAction);
    }
    /**
     *  A count changed observable starting with the current count
     */
    public get countChanged() {
        return this._innerCache.countChanged;
    }
    /**
     *  Returns a filtered changeset of cache changes preceded with the initial state
     *
     * @param predicate The predicate.
     */
    public connect(predicate?: (value: TObject) => boolean) {
        return this._innerCache.connect(predicate);
    }
    public preview(predicate?: (value: TObject) => boolean) {
        return this._innerCache.preview(predicate);
    }
    /**
     *  Returns an observable of any changes which match the specified key. The sequence starts with the initial item in the cache (if there is one).
     *
     * @param key The key.
     */
    public watch(key: TKey) {
        return this._innerCache.watch(key);
    }
    /**
     *  The total count of cached items
     */
    public get size() {
        return this._innerCache.size;
    }
    /**
     *  Gets the values
     */
    public values() {
        return this._innerCache.values();
    }
    /**
     *  Gets the entries
     */
    public entries() {
        return this._innerCache.entries();
    }
    /**
     *  Gets the keys
     */
    public keys() {
        return this._innerCache.keys();
    }
    /**
     *  Lookup a single item using the specified key.
     * @param key The key.
     */
    public lookup(key: TKey) {
        return this._innerCache.lookup(key);
    }
    /** @internal */
    public getInitialUpdates(filter?: (value: TObject) => boolean) {
        return this._innerCache.getInitialUpdates(filter);
    }
    public dispose() {
        this._innerCache.dispose();
    }
}
