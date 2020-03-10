import { Change } from './Change';
import { ArrayOrIterable } from '../util/ArrayOrIterable';
import { IChangeSet } from './IChangeSet';
import { ICache } from './ICache';
import { ChangeSet } from './ChangeSet';
import { isIterable } from '../util/isIterable';
import { tryGetValue } from '../util/tryGetValue';

/**
 *  A cache which captures all changes which are made to it. These changes are recorded until CaptureChanges() at which point thw changes are cleared.
 *
 *  Used for creating custom operators
 */
export class ChangeAwareCache<TObject, TKey> implements ICache<TObject, TKey> {
    private _changes?: ChangeSet<TObject, TKey>;
    private _data?: Map<TKey, TObject>;

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
    public constructor(data?: Map<TKey, TObject>) {
        this._data = data;
    }

    public lookup(key: TKey) {
        return this._data?.get(key);
    }

    /**
     * Adds the item to the cache without checking whether there is an existing value in the cache
     */
    public add(item: TObject, key: TKey) {
        this.ensureInitialised();
        this._changes!.add(new Change<TObject, TKey>('add', key, item));
        this._data!.set(key, item);
    }

    public addOrUpdate(item: TObject, key: TKey) {
        this.ensureInitialised();
        const data = tryGetValue(this._data!, key);
        this._changes!.add(data.found
            ? new Change<TObject, TKey>('update', key, item, data.value)
            : new Change<TObject, TKey>('add', key, item),
        );

        this._data!.set(key, item);
    }

    /**
     *  Removes the item matching the specified keys.
     * @param keys The keys.
     */
    public remove(keys: ArrayOrIterable<TKey> | TKey) {
        if (this._data == null) {
            return;
        }

        if (Array.isArray(keys) && typeof keys !== 'string') {
            this.ensureInitialised();
            for (let i = 0; i < keys.length; i++) {
                this.remove(keys[i]);
            }
        } else if (isIterable(keys) && typeof keys !== 'string') {
            this.ensureInitialised();
            for (const key of keys) {
                this.remove(key);
            }
        } else {
            this.ensureInitialised();
            const data = tryGetValue<TKey, TObject>(this._data!, keys);
            if (data.found) {
                this._changes!.add(new Change<TObject, TKey>('remove', keys, data.value!));
                this._data!.delete(keys);
            }
        }
    }

    /**
     *  Raises an evaluate change for the specified keys
     */
    public refresh(keys?: ArrayOrIterable<TKey> | TKey) {
        if (this._data == null) {
            return;
        }

        if (!keys) {
            this.ensureInitialised();
            this._data!.forEach((key, value) => {
                this._changes!.add(new Change<TObject, TKey>('refresh', value, key));
            });
            return;
        }

        if (Array.isArray(keys)) {
            this.ensureInitialised();
            for (let i = 0; i < keys.length; i++) {
                this.refresh(keys[i]);
            }
        } else if (isIterable(keys)) {
            this.ensureInitialised();
            for (const key of keys) {
                this.refresh(key);
            }
        } else {
            this.ensureInitialised();
            const data = tryGetValue<TKey, TObject>(this._data!, keys);
            if (data.found) {
                this._changes!.add(new Change<TObject, TKey>('refresh', keys, data.value));
            }
        }
    }

    public clear() {
        this.ensureInitialised();
        this._data!.forEach((key, value) => {
            this._changes!.delete(new Change<TObject, TKey>('remove', value, key));
        });
        this._data!.clear();
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
                    this.remove(change.key);
                    break;
                case 'refresh':
                    this.refresh(change.key);
                    break;
            }
        }
    }

    private ensureInitialised() {
        if (this._changes == null) {
            this._changes = new ChangeSet<TObject, TKey>();
        }

        if (this._data == null) {
            this._data = new Map<TKey, TObject>();
        }
    }

    /**
     *  Create a changeset from recorded changes and clears known changes.
     */
    public captureChanges(): ChangeSet<TObject, TKey> {
        if (this._changes == null || this._changes.size == 0) {
            return ChangeSet.empty<TObject, TKey>();
        }

        const copy = this._changes;
        this._changes = undefined;
        return copy;
    }

    readonly [Symbol.toStringTag]: string;

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this.entries();
    }

    refreshKey(key: TKey): void {
        this.refresh(key);
    }

    refreshKeys(keys: ArrayOrIterable<TKey>): void;
    refreshKeys(...keys: TKey[]): void;
    refreshKeys(keys?: TKey | ArrayOrIterable<TKey>, ...rest: TKey[]): void {
        if (Array.isArray(keys)) {
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                this.refresh(key);
            }
        } else if (isIterable(keys)) {
            for (const key of keys) {
                this.refresh(key);
            }
        } else if (keys) {
            this.refresh(keys);
            for (let i = 0; i < rest.length; i++) {
                const entry = rest[i];
                this.refresh(entry);
            }
        }
    }

    removeKey(key: TKey): void {
        this.remove(key);
    }

    removeKeys(keys: ArrayOrIterable<TKey>): void;
    removeKeys(...keys: TKey[]): void;
    removeKeys(keys?: TKey | ArrayOrIterable<TKey>, ...rest: TKey[]): void {
        if (Array.isArray(keys)) {
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                this.remove(key);
            }
        } else if (isIterable(keys)) {
            for (const key of keys) {
                this.remove(key);
            }
        } else if (keys) {
            this.remove(keys);
            for (let i = 0; i < rest.length; i++) {
                const entry = rest[i];
                this.remove(entry);
            }
        }
    }

}