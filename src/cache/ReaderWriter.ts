import { IChangeSet } from './IChangeSet';
import { ICacheUpdater } from './ICacheUpdater';
import { ISourceUpdater } from './ISourceUpdater';
import { Change } from './Change';
import { ChangeAwareCache } from './ChangeAwareCache';
import { ChangeSet } from './ChangeSet';
import { CacheUpdater } from './CacheUpdater';
import { toArray } from 'ix/iterable';

export class ReaderWriter<TObject, TKey> {
    private readonly _keySelector?: (object: TObject) => TKey;
    private _data = new Map<TKey, TObject>(); //could do with priming this on first time load
    private _activeUpdater?: CacheUpdater<TObject, TKey>;
    private readonly _deepEqual: boolean;

    public constructor(deepEqual: boolean);
    public constructor(keySelector?: (object: TObject) => TKey, deepEqual?: boolean);
    public constructor(keySelector?: ((object: TObject) => TKey) | boolean, deepEqual = false) {
        if (typeof keySelector === 'boolean') {
            deepEqual = keySelector;
            keySelector = undefined;
        }
        this._keySelector = keySelector;
        this._deepEqual = deepEqual;
    }

    public write(
        changes: IChangeSet<TObject, TKey> | ((updater: ICacheUpdater<TObject, TKey>) => void) | ((updater: ISourceUpdater<TObject, TKey>) => void),
        previewHandler: ((changes: ChangeSet<TObject, TKey>) => void) | undefined,
        collectChanges: boolean,
    ): ChangeSet<TObject, TKey> {
        if (typeof changes === 'function') {
            return this.doUpdate(changes, previewHandler, collectChanges);
        }
        return this.doUpdate(
            (updater: ICacheUpdater<TObject, TKey>) => {
                updater.clone(changes);
            },
            previewHandler,
            collectChanges,
        );
    }

    private doUpdate(
        updateAction: (updater: CacheUpdater<TObject, TKey>) => void,
        previewHandler: ((changes: ChangeSet<TObject, TKey>) => void) | undefined,
        collectChanges: boolean,
    ): ChangeSet<TObject, TKey> {
        let changeAwareCache;
        if (previewHandler) {
            let copy = new Map<TKey, TObject>(this._data);
            changeAwareCache = new ChangeAwareCache<TObject, TKey>(this._data, this._deepEqual);

            this._activeUpdater = new CacheUpdater<TObject, TKey>(changeAwareCache, this._keySelector);
            updateAction(this._activeUpdater);
            this._activeUpdater = undefined;

            const changes = changeAwareCache.captureChanges();

            {
                const intermediate = this._data;
                this._data = copy;
                copy = intermediate;
            }
            previewHandler(changes);
            {
                this._data = copy;
            }

            return changes;
        }

        if (collectChanges) {
            changeAwareCache = new ChangeAwareCache<TObject, TKey>(this._data, this._deepEqual);

            this._activeUpdater = new CacheUpdater<TObject, TKey>(changeAwareCache, this._keySelector);
            updateAction(this._activeUpdater);
            this._activeUpdater = undefined;

            return changeAwareCache.captureChanges();
        }

        this._activeUpdater = new CacheUpdater<TObject, TKey>(this._data, this._keySelector);
        updateAction(this._activeUpdater);
        this._activeUpdater = undefined;

        return ChangeSet.empty<TObject, TKey>();
    }

    /**
     * @internal
     **/
    public writeNested(updateAction: ((updater: ICacheUpdater<TObject, TKey>) => void) | ((updater: ISourceUpdater<TObject, TKey>) => void)): void {
        if (this._activeUpdater == undefined) {
            throw new Error('WriteNested can only be used if another write is already in progress.');
        }

        updateAction(this._activeUpdater);
    }

    public getInitialUpdates(filter?: (value: TObject) => boolean): ChangeSet<TObject, TKey> {
        const dictionary = this._data;

        if (dictionary.size === 0) {
            return ChangeSet.empty<TObject, TKey>();
        }

        const changes = new ChangeSet<TObject, TKey>();

        for (const [key, value] of dictionary.entries()) {
            if (filter == undefined || filter(value)) {
                changes.add(Change.add(key, value));
            }
        }

        return changes;
    }

    public get keys() {
        return toArray(this._data.keys());
    }

    public get entries() {
        return toArray(this._data.entries());
    }

    public get values() {
        return toArray(this._data.values());
    }

    public lookup(key: TKey) {
        return this._data.get(key);
    }

    public get size() {
        return this._data.size;
    }
}
