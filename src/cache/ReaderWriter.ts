import { IChangeSet } from './IChangeSet';
import { ICacheUpdater } from './ICacheUpdater';
import { ISourceUpdater } from './ISourceUpdater';
import { Change } from './Change';
import { ChangeAwareCache } from './ChangeAwareCache';
import { ChangeSet } from './ChangeSet';
import { CacheUpdater } from './CacheUpdater';

export class ReaderWriter<TObject, TKey> {
    private readonly _keySelector?: (obj: TObject) => TKey;
    private _data = new Map<TKey, TObject>(); //could do with priming this on first time load
    private _activeUpdater?: CacheUpdater<TObject, TKey>;

    public constructor(keySelector?: (obj: TObject) => TKey) {
        this._keySelector = keySelector;
    }

    public write(changes: IChangeSet<TObject, TKey> | ((updater: ICacheUpdater<TObject, TKey>) => void) | ((updater: ISourceUpdater<TObject, TKey>) => void), previewHandler: ((changes: ChangeSet<TObject, TKey>) => void) | undefined, collectChanges: boolean): ChangeSet<TObject, TKey> {
        if (typeof (changes) === 'function') {
            return this.doUpdate(changes, previewHandler, collectChanges);
        }
        return this.doUpdate((updater: ICacheUpdater<TObject, TKey>) => updater.clone(changes), previewHandler, collectChanges);
    }

    private doUpdate(updateAction: (updater: CacheUpdater<TObject, TKey>) => void, previewHandler: ((changes: ChangeSet<TObject, TKey>) => void) | undefined, collectChanges: boolean): ChangeSet<TObject, TKey> {
        let changeAwareCache;
        if (previewHandler) {
            let copy = new Map<TKey, TObject>(this._data);
            changeAwareCache = new ChangeAwareCache<TObject, TKey>(this._data);

            this._activeUpdater = new CacheUpdater<TObject, TKey>(changeAwareCache, this._keySelector);
            updateAction(this._activeUpdater);
            this._activeUpdater = undefined;

            const changes = changeAwareCache.captureChanges();

            {
                let intermediate = this._data;
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
            changeAwareCache = new ChangeAwareCache<TObject, TKey>(this._data);

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
        if (this._activeUpdater == null) {
            throw new Error('WriteNested can only be used if another write is already in progress.');
        }

        updateAction(this._activeUpdater);
    }

    public getInitialUpdates(filter?: (value: TObject) => boolean): ChangeSet<TObject, TKey> {
        const dictionary = this._data;

        if (dictionary.size == 0) {
            return ChangeSet.empty<TObject, TKey>();
        }

        const changes = new ChangeSet<TObject, TKey>();

        for (const [key, value] of dictionary.entries()) {
            if (filter == null || filter(value)) {
                changes.add(new Change<TObject, TKey>('add', key, value));
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
