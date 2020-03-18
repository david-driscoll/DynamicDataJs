import { IObservableCache } from '../../src/cache/IObservableCache';
import { Disposable, IDisposable } from '../../src/util';
import { publish } from 'rxjs/operators';
import { IChangeSet } from '../../src/cache/IChangeSet';
import { ConnectableObservable, Observable } from 'rxjs';
import { ChangeSummary } from '../../src/diagnostics/ChangeSummary';
import { collectUpdateStats } from '../../src/diagnostics/operators/CollectUpdateStats';
import { asObservableCache } from '../../src/cache/operators/asObservableCache';

export class ChangeSetAggregator<TChangeSet extends IChangeSet<TObject, TKey>, TObject = any, TKey = any> implements IDisposable {
    private readonly _disposer: IDisposable;
    private _summary: ChangeSummary = ChangeSummary.empty;
    private _error?: Error;

    /**
     * Initializes a new instance of the <see cref="DistinctChangeSetAggregator{TValue}"/> class.
     * @param source The source.
     */
    public constructor(source: Observable<TChangeSet>) {
        const published: ConnectableObservable<TChangeSet> = source.pipe(publish()) as any;

        const error = published.subscribe(updates => {
        }, ex => this._error = ex);
        const results = published
            .subscribe(updates => this.messages.push(updates));
        this.data = asObservableCache(published);
        const summariser = published
            .pipe(collectUpdateStats())
            .subscribe(summary => this._summary = summary);

        const connected = published.connect();
        this._disposer = Disposable.create(() => {
            connected.unsubscribe();
            summariser.unsubscribe();
            results.unsubscribe();
            error.unsubscribe();
        });
    }

    /**
     * Gets the data.
     */
    public readonly data: IObservableCache<TObject, TKey>;

    /**
     * Gets the messages.
     */
    public readonly messages: TChangeSet[] = [];

    /**
     * Gets the summary.
     */
    public get summary() {
        return this._summary;
    }

    /**
     * Gets the error.
     */
    public get error() {
        return this._error;
    }

    /**
     * Performs application-defined tasks associated with freeing, releasing, or resetting unmanaged resources.
     */
    public dispose() {
        this._disposer?.dispose();
    }
}

export function asAggregator<TChangeSet extends IChangeSet<TObject, TKey>, TObject, TKey>(source: Observable<TChangeSet>) {
    return new ChangeSetAggregator<TChangeSet, TObject, TKey>(source);
}
