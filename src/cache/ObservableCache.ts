import { asapScheduler, concat, defer, Observable, scheduled, Subject } from 'rxjs';
import { IChangeSet } from './IChangeSet';
import { Disposable, IDisposable, Lazy } from '../util';
import { ReaderWriter } from './ReaderWriter';
import { distinctUntilChanged, finalize, startWith } from 'rxjs/operators';
import { ICacheUpdater } from './ICacheUpdater';
import { ChangeSet } from './ChangeSet';
import { ISourceUpdater } from './ISourceUpdater';
import { Change } from './Change';
import { filter } from './operators/filter';
import { notEmpty } from './operators/notEmpty';
import { IObservableCache } from './IObservableCache';

export class ObservableCache<TObject, TKey> implements IObservableCache<TObject, TKey> {
    private readonly _changes = new Subject<IChangeSet<TObject, TKey>>();
    private readonly _changesPreview = new Subject<IChangeSet<TObject, TKey>>();
    private readonly _countChanged = new Lazy<Subject<number>>(() => new Subject<number>());
    private readonly _readerWriter: ReaderWriter<TObject, TKey>;
    private readonly _cleanUp: IDisposable;
    private _editLevel = 0; // The level of recursion in editing.


    constructor(sourceOrKeySelector?: Observable<IChangeSet<TObject, TKey>> | ((obj: TObject) => TKey)) {
        if (!sourceOrKeySelector || typeof sourceOrKeySelector == 'function') {
            this._readerWriter = new ReaderWriter<TObject, TKey>(sourceOrKeySelector);

            this._cleanUp = Disposable.create(() => {
                this._changes.complete();
                this._changesPreview.complete();
                if (this._countChanged.isValueCreated) {
                    this._countChanged.value!.complete();
                }
            });
        } else {
            this._readerWriter = new ReaderWriter<TObject, TKey>();

            const loader = sourceOrKeySelector
                .pipe(
                    finalize(() => {
                        this._changes.complete();
                        this._changesPreview.complete();
                    }),
                )
                .subscribe(
                    changeset => {
                        const previewHandler = this._changesPreview.observers.length ? this.invokePreview : undefined;
                        const changes = this._readerWriter.write(changeset, previewHandler, !!this._changesPreview.observers.length);
                        this.invokeNext(changes);
                    },
                    ex => {
                        this._changesPreview.error(ex);
                        this._changes.error(ex);
                    },
                );

            this._cleanUp = Disposable.create(() => {
                loader.unsubscribe();
                this._changes.complete();
                this._changesPreview.complete();
                if (this._countChanged.isValueCreated) {
                    this._countChanged.value!.complete();
                }
            });
        }
    }

    [Symbol.iterator](): IterableIterator<[TKey, TObject]> {
        return this.entries();
    }

    /**
     * @internal
     */
    public updateFromIntermediate(updateAction: (updater: ICacheUpdater<TObject, TKey>) => void) {
        let changes: ChangeSet<TObject, TKey> | null = null;

        this._editLevel++;
        if (this._editLevel == 1) {
            const previewHandler = this._changesPreview.observers.length ? this.invokePreview : undefined;
            changes = this._readerWriter.write(updateAction, previewHandler, !!this._changes.observers.length);
        } else {
            this._readerWriter.writeNested(updateAction);
        }

        this._editLevel--;

        if (this._editLevel == 0) {
            this.invokeNext(changes!);
        }
    }

    /**
     * @internal
     */
    updateFromSource(updateAction: (updater: ISourceUpdater<TObject, TKey>) => void) {
        let changes: ChangeSet<TObject, TKey> | null = null;

        this._editLevel++;
        if (this._editLevel == 1) {
            const previewHandler = this._changesPreview.observers.length ? this.invokePreview : undefined;
            changes = this._readerWriter.write(updateAction, previewHandler, !!this._changes.observers.length);
        } else {
            this._readerWriter.writeNested(updateAction);
        }

        this._editLevel--;

        if (this._editLevel == 0) {
            this.invokeNext(changes!);
        }
    }

    private invokePreview(changes: ChangeSet<TObject, TKey>) {
        if (changes.size != 0) {
            this._changesPreview.next(changes);
        }
    }

    private invokeNext(changes: ChangeSet<TObject, TKey>) {
        if (changes.size != 0) {
            this._changes.next(changes);
        }

        if (this._countChanged.isValueCreated) {
            this._countChanged.value!.next(this._readerWriter.size);
        }

    }

    public get countChanged() {
        return this._countChanged.value!.pipe(
            startWith(this._readerWriter.size),
            distinctUntilChanged(),
        );
    }

    public watch(key: TKey) {
        return new Observable<Change<TObject, TKey>>(
            observer => {
                const initial = this._readerWriter.lookup(key);
                if (initial) {
                    observer.next(new Change<TObject, TKey>('add', key, initial));
                }

                return this._changes
                    .pipe(finalize(observer.complete))
                    .subscribe(changes => {
                        for (let change of changes) {
                            if (change.key === key) {
                                observer.next(change);
                            }
                        }
                    });

            });
    }

    public connect(predicate?: (value: TObject) => boolean): Observable<IChangeSet<TObject, TKey>> {
        return defer(() => {
            const initial = this.getInitialUpdates(predicate) as IChangeSet<TObject, TKey>;
            const changes = concat(scheduled([initial], asapScheduler), this._changes.asObservable());

            return predicate ? changes.pipe(filter(x => predicate(x)), notEmpty()) : changes;
        });
    }

    public preview(predicate?: (value: TObject) => boolean): Observable<IChangeSet<TObject, TKey>> {
        return predicate ? this._changesPreview.pipe(filter(predicate)) : this._changesPreview;
    }

    /**
     * @internal
     */
    getInitialUpdates(filter?: (value: TObject) => boolean) {
        return this._readerWriter.getInitialUpdates(filter);
    }

    public get size() {
        return this._readerWriter.size;
    }

    public entries() {
        return this._readerWriter.entries[Symbol.iterator]();
    }

    public values() {
        return this._readerWriter.values[Symbol.iterator]();
    }

    public keys() {
        return this._readerWriter.keys[Symbol.iterator]();
    }

    public lookup(key: TKey) {
        return this._readerWriter.lookup(key);
    }

    public dispose() {
        this._cleanUp.dispose();
    }
}


