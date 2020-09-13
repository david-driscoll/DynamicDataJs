import { Change } from './Change';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { IChangeSet } from './IChangeSet';
import { ICache } from './ICache';
import { ChangeSet } from './ChangeSet';
import { isIterable } from '../util/isIterable';
import { tryGetValue } from '../util/tryGetValue';
import { deepEqualMapAdapter } from '../util/deepEqualMapAdapter';

/**
 *  A cache which captures all changes which are made to it. These changes are recorded until CaptureChanges() at which point thw changes are cleared.
 *
 *  Used for creating custom operators
 */
export class ChangeAwareCache<TObject, TKey> implements ICache<TObject, TKey> {
    private _changes?: ChangeSet<TObject, TKey>;
    private _data: Map<TKey, TObject>;
    private readonly _deepEqual: boolean;
    private _mapAdapter!: {
        get: typeof Map.prototype.get;
        set: typeof Map.prototype.set;
        has: typeof Map.prototype.has;
        delete: typeof Map.prototype.delete;
    };

    public get size() {
        return this._data?.size ?? 0;
    }

    public entries() {
        return this._data?.entries() ?? emptyIterator<[TKey, TObject]>();
    }

    public values() {
        return this._data?.values() ?? emptyIterator<TObject>();
    }

    public keys() {
        return this._data?.keys() ?? emptyIterator<TKey>();
    }

    /**
     Initializes a new instance of the <see cref="T:System.Object"></see> class.
     */
    public constructor(deepEqual: boolean);
    public constructor(data?: Map<TKey, TObject>, deepEqual?: boolean);
    public constructor(data?: Map<TKey, TObject> | boolean, deepEqual = false) {
        if (typeof data === 'boolean') {
            this._data = new Map<TKey, TObject>();
            deepEqual = data;
        } else {
            this._data = data!;
        }
        this._deepEqual = deepEqual;
    }

    public lookup(key: TKey) {
        return this._mapAdapter.get(key);
    }

    /**
     * Adds the item to the cache without checking whether there is an existing value in the cache
     */
    public add(item: TObject, key: TKey) {
        this.ensureInitialised();
        this._changes!.add(new Change<TObject, TKey>('add', key, item));
        this._mapAdapter.set(key, item);
    }

    public addOrUpdate(item: TObject, key: TKey) {
        this.ensureInitialised();
        const data = tryGetValue(this._mapAdapter, key);
        this._changes!.add(data.found ? new Change<TObject, TKey>('update', key, item, data.value) : new Change<TObject, TKey>('add', key, item));

        this._mapAdapter.set(key, item);
    }

    /**
     *  Raises an evaluate change for the specified keys
     */
    public refresh() {
        if (this._data == undefined) {
            return;
        }

        this.ensureInitialised();
        this._data.forEach((key, value) => {
            this._changes!.add(new Change<TObject, TKey>('refresh', value, key));
        });
    }

    public clear() {
        this.ensureInitialised();
        this._data.forEach((key, value) => {
            this._changes!.add(new Change<TObject, TKey>('remove', value, key));
        });
        this._data.clear();
    }

    public clone(changes: IChangeSet<TObject, TKey>) {
        this.ensureInitialised();
        for (const change of changes.values()) {
            switch (change.reason) {
                case 'add':
                case 'update':
                    this.addOrUpdate(change.current, change.key);
                    break;
                case 'remove':
                    this.removeKey(change.key);
                    break;
                case 'refresh':
                    this.refreshKey(change.key);
                    break;
            }
        }
    }

    private ensureInitialised() {
        if (this._changes == undefined) {
            this._changes = new ChangeSet<TObject, TKey>();
        }

        if (this._data == undefined) {
            this._data = new Map<TKey, TObject>();
        }

        if (this._mapAdapter == undefined) {
            this._mapAdapter = this._deepEqual ? deepEqualMapAdapter(this._data) : this._data;
        }
    }

    /**
     *  Create a changeset from recorded changes and clears known changes.
     */
    public captureChanges(): ChangeSet<TObject, TKey> {
        if (this._changes === undefined || this._changes.size == 0) {
            this._changes = undefined;
            return ChangeSet.empty<TObject, TKey>();
        }

        const copy = this._changes;
        this._changes = undefined;
        return copy;
    }

    readonly [Symbol.toStringTag] = 'Cache';

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this.entries();
    }

    refreshKey(key: TKey): void {
        this.ensureInitialised();
        const data = tryGetValue<TKey, TObject>(this._mapAdapter, key);
        if (data.found) {
            this._changes!.add(new Change<TObject, TKey>('refresh', key, data.value));
        }
    }

    refreshKeys(keys: ArrayOrIterable<TKey>): void {
        this.ensureInitialised();
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

    removeKey(key: TKey): void {
        this.ensureInitialised();
        const data = tryGetValue<TKey, TObject>(this._mapAdapter, key);
        if (data.found) {
            this._changes!.add(new Change<TObject, TKey>('remove', key, data.value!));
            this._mapAdapter.delete(key);
        }
    }

    removeKeys(keys: ArrayOrIterable<TKey>): void {
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
}
