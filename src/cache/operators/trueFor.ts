import { combineLatest, ConnectableObservable, Observable, OperatorFunction } from 'rxjs';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';
import { IChangeSet } from '../IChangeSet';
import { transform } from './transform';
import { distinctUntilChanged, map, publish, tap } from 'rxjs/operators';
import { mergeMany } from './mergeMany';
import { CompositeDisposable } from '../../util';
import { toCollection } from './toCollection';

export function trueFor<TObject, TKey, TValue>(
    observableSelector: (value: TObject) => Observable<TValue>,
    collectionMatcher: (data: ArrayOrIterable<ObservableWithValue<TObject, TValue>>) => boolean,
): OperatorFunction<IChangeSet<TObject, TKey>, boolean> {
    return function trueForOperator(source) {
        return new Observable<boolean>(observer => {
            const transformed: ConnectableObservable<IChangeSet<ObservableWithValue<TObject, TValue>, TKey>> = source
                .pipe(
                    transform(t => new ObservableWithValue<TObject, TValue>(t, observableSelector(t))),
                    publish(),
                ) as any;
            const inlineChanges = transformed
                .pipe(mergeMany(t => t.observable));
            const queried = transformed
                .pipe(toCollection());

            //nb: we do not care about the inline change because we are only monitoring it to cause a re-evalutaion of all items
            const publisher = combineLatest([queried, inlineChanges])
                .pipe(
                    map(([items, _]) => collectionMatcher(items)),
                    distinctUntilChanged(),
                )
                .subscribe(observer);

            return new CompositeDisposable(publisher, transformed.connect());
        });
    };
}

class ObservableWithValue<TObject, TValue> {
    private _latestValue?: TValue;

    public constructor(item: TObject, source: Observable<TValue>) {
        this.item = item;
        this.observable = source.pipe(tap(value => this._latestValue = value));
    }

    public readonly item: TObject;

    public get latestValue() {
        return this._latestValue;
    }

    public readonly observable: Observable<TValue>;
}
