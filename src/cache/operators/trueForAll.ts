import { Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { trueFor } from './trueFor';
import { every } from 'ix/iterable';

/**
 * Produces a boolean observable indicating whether the latest resulting value from all of the specified observables matches
 * the equality condition. The observable is re-evaluated whenever
 * i) The cache changes
 * or ii) The inner observable changes
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TValue The type of the value.
 * @param observableSelector Selector which returns the target observable
 * @param equalityCondition The equality condition.
 */
export function trueForAll<TObject, TKey, TValue>(
    observableSelector: (value: TObject) => Observable<TValue>,
    equalityCondition: (value: TObject, item: TValue) => boolean,
): OperatorFunction<IChangeSet<TObject, TKey>, boolean> {
    return function trueForAllOperator(source) {
        return source.pipe(
            trueFor(observableSelector, items => {
                items //?
                return every(items, o => {
                    o //?
                    return (o.latestValue !== undefined && equalityCondition(o.item, o.latestValue)) ?? false;
                });
            }),
        );
    };
}