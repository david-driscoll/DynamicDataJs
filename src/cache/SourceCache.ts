import { ISourceCache } from './ISourceCache';
import { ISourceUpdater } from './ISourceUpdater';
import { Observable } from 'rxjs';
import { Change } from './Change';
import { IChangeSet } from './IChangeSet';
import { ObservableCache } from './ObservableCache';
import { IEqualityComparer } from '../util/isEqualityComparer';
import { ArrayOrIterable } from '../util/ArrayOrIterable';

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

    [Symbol.toStringTag]: "ObservableCache" = 'ObservableCache';

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

    getKey(item: TObject) {
        return this._innerCache.getKey(item);
    }
}

export function updatable<TObject, TKey>(sourceCache: ISourceCache<TObject, TKey>): ISourceCache<TObject, TKey> & ISourceUpdater<TObject, TKey> {
    return new SimpleSourceCache(sourceCache);
}

class SimpleSourceCache<TObject, TKey> implements ISourceCache<TObject, TKey>, ISourceUpdater<TObject, TKey> {
    constructor(private readonly _sourceCache: ISourceCache<TObject, TKey>) {
    }

    [Symbol.toStringTag]: "ObservableCache" = 'ObservableCache';

    edit(updateAction: (updater: ISourceUpdater<TObject, TKey>) => void): void {
        return this._sourceCache.edit(updateAction);
    }

    watch(key: TKey): Observable<Change<TObject, TKey>> {
        return this._sourceCache.watch(key);
    }

    connect(predicate?: ((obj: TObject) => boolean) | undefined): Observable<IChangeSet<TObject, TKey>> {
        return this._sourceCache.connect(predicate);
    }

    preview(predicate?: ((obj: TObject) => boolean) | undefined): Observable<IChangeSet<TObject, TKey>> {
        return this._sourceCache.preview(predicate);
    }

    get countChanged() {
        return this._sourceCache.countChanged;
    }

    keys(): IterableIterator<TKey> {
        return this._sourceCache.keys();
    }

    values(): IterableIterator<TObject> {
        return this._sourceCache.values();
    }

    entries(): IterableIterator<[TKey, TObject]> {
        return this._sourceCache.entries();
    }

    lookup(key: TKey): TObject | undefined {
        return this._sourceCache.lookup(key);
    }

    get size() {
        return this._sourceCache.size;
    }

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this._sourceCache[Symbol.iterator]();
    }

    dispose(): void {
        return this._sourceCache.dispose();
    }

    addOrUpdate(item: TObject): void;
    addOrUpdate(item: TObject, comparer: IEqualityComparer<TObject>): void;
    addOrUpdate(item: TObject, key: TKey): void;
    addOrUpdate(item: TObject, comparer?: IEqualityComparer<TObject> | TKey): void {
        return this._sourceCache.edit(updater => updater.addOrUpdate(item, comparer as any));
    }

    addOrUpdatePairs(entries: Array<[TKey, TObject]> | Iterable<[TKey, TObject]>): void {
        return this._sourceCache.edit(updater => updater.addOrUpdatePairs(entries));
    }

    addOrUpdateValues(entries: Array<TObject> | Iterable<TObject>): void;
    addOrUpdateValues(...entries: TObject[]): void;
    addOrUpdateValues(...entries: (ArrayOrIterable<TObject> | TObject)[]): void {
        return this._sourceCache.edit(updater => updater.addOrUpdateValues(...entries as any));
    }

    clear(): void {
        return this._sourceCache.edit(updater => updater.clear());
    }

    clone(changes: IChangeSet<TObject, TKey>): void {
        return this._sourceCache.edit(updater => updater.clone(changes));
    }

    getKey(item: TObject): TKey {
        return this._sourceCache.getKey(item);
    }

    load(entries: Array<TObject> | Iterable<TObject>): void;
    load(...entries: TObject[]): void;
    load(...entries: (ArrayOrIterable<TObject> | TObject)[]): void {
        return this._sourceCache.edit(updater => updater.load(...entries as any));
    }

    refresh(): void;
    refresh(item: TObject): void;
    refresh(item?: TObject): void {
        return this._sourceCache.edit(updater => updater.refresh(item as any));
    }

    refreshKey(key: TKey): void {
        return this._sourceCache.edit(updater => updater.refreshKey(key));
    }

    refreshKeys(keys: Array<TKey> | Iterable<TKey>): void;
    refreshKeys(...keys: TKey[]): void;
    refreshKeys(...keys: (ArrayOrIterable<TKey> | TKey)[]): void {
        return this._sourceCache.edit(updater => updater.refreshKeys(...keys as any));
    }

    refreshValues(entries: Array<TObject> | Iterable<TObject>): void;
    refreshValues(...entries: TObject[]): void;
    refreshValues(...entries: (ArrayOrIterable<TObject> | TObject)[]): void {
        return this._sourceCache.edit(updater => updater.refreshValues(...entries as any));
    }

    remove(item: TObject): void {
        return this._sourceCache.edit(updater => updater.remove(item));
    }

    removeKey(key: TKey): void {
        return this._sourceCache.edit(updater => updater.removeKey(key));
    }

    removeKeys(key: Array<TKey> | Iterable<TKey>): void;
    removeKeys(...keys: TKey[]): void;
    removeKeys(...key: (ArrayOrIterable<TKey> | TKey)[]): void {
        return this._sourceCache.edit(updater => updater.removeKeys(...key as any));
    }

    removePairs(entries: Array<[TKey, TObject]> | Iterable<[TKey, TObject]>): void {
        return this._sourceCache.edit(updater => updater.removePairs(entries));
    }

    removeValues(entries: Array<TObject> | Iterable<TObject>): void;
    removeValues(...entries: TObject[]): void;
    removeValues(...entries: (ArrayOrIterable<TObject> | TObject)[]): void {
        return this._sourceCache.edit(updater => updater.removeValues(...entries as any));
    }
}