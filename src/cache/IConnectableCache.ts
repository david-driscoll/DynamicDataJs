import { Observable } from 'rxjs';
import { Change } from './Change';
import { IChangeSet } from './IChangeSet';

/**
 * A cache for observing and querying in memory data
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface IConnectableCache<TObject, TKey> {
    /**
     *  Returns an observable of any changes which match the specified key.  The sequence starts with the initial item in the cache (if there is one).
     * @param key The key
     */
    watch(key: TKey): Observable<Change<TObject, TKey>>;

    /**
     *  Returns a filtered stream of cache changes preceded with the initial filtered state
     * @param predicate The result will be filtered using the specified predicate
     */
    connect(predicate?: (object: TObject) => boolean): Observable<IChangeSet<TObject, TKey>>;

    /**
     * Returns a filtered stream of cache changes.
     * Unlike Connect(), the returned observable is not prepended with the caches initial items.
     *
     * @param predicate The result will be filtered using the specified predicate
     */
    preview(predicate?: (object: TObject) => boolean): Observable<IChangeSet<TObject, TKey>>;

    /**
     * A count changed observable starting with the current count
     */
    readonly countChanged: Observable<number>;
}
