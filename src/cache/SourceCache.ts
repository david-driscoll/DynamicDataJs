import { ISourceCache } from './ISourceCache';
import { ISourceUpdater } from './ISourceUpdater';
import { Observable } from 'rxjs';
import { Change } from './Change';
import { IChangeSet } from './IChangeSet';
import { ObservableCache } from './ObservableCache';

/**
 * An observable cache which exposes an update API.  Used at the root
 * of all observable chains
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export class SourceCache<TObject, TKey> implements ISourceCache<TObject, TKey> {
    private readonly _innerCache: ObservableCache<TObject, TKey>;

    /**
     * Initializes a new instance of the <see cref="SourceCache{TObject, TKey}"/> class.
     * @param keySelector The key selector.
     */
    public constructor(keySelector: (value: TObject) => TKey) {
        this._innerCache = new ObservableCache<TObject, TKey>(keySelector);
    }

    edit(updateAction: (updater: ISourceUpdater<TObject, TKey>) => void): void {
        this._innerCache.updateFromSource(updateAction);
    }

    watch(key: TKey): Observable<Change<TObject, TKey>> {
        return this._innerCache.watch(key);
    }

    connect(predicate?: ((obj: TObject) => boolean) | undefined): Observable<IChangeSet<TObject, TKey>> {
        return this._innerCache.connect(predicate);
    }

    preview(predicate?: ((obj: TObject) => boolean) | undefined): Observable<IChangeSet<TObject, TKey>> {
        return this._innerCache.preview(predicate);
    }

    get countChanged() {
        return this._innerCache.countChanged;
    }

    keys(): IterableIterator<TKey> {
        return this._innerCache.keys();
    }

    values(): IterableIterator<TObject> {
        return this._innerCache.values();
    }

    entries(): IterableIterator<[TKey, TObject]> {
        return this._innerCache.entries();
    }

    lookup(key: TKey): TObject | undefined {
        return this._innerCache.lookup(key);
    }

    get size() {
        return this._innerCache.size;
    }

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this._innerCache[Symbol.iterator]();
    }

    dispose(): void {
        this._innerCache.dispose();
    }
}