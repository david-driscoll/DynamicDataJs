import { Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { trueFor } from './trueFor';
import { some } from 'ix/iterable';

/**
 * Produces a boolean observable indicating whether the resulting value of whether any of the specified observables matches
 * the equality condition. The observable is re-evaluated whenever
 * i) The cache changes.
 * or ii) The inner observable changes.
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TValue The type of the value.
 * @param observableSelector The observable selector.
 * @param equalityCondition The equality condition.
 */
export function trueForAny<TObject, TKey, TValue>(
    observableSelector: (value: TObject) => Observable<TValue>,
    equalityCondition: (value: TObject, item: TValue) => boolean,
): OperatorFunction<IChangeSet<TObject, TKey>, boolean> {
    return function trueForAllOperator(source) {
        return source.pipe(
            trueFor(observableSelector, items => {
                return some(items, {
                    predicate: o => {
                        return (o.latestValue !== undefined && equalityCondition(o.item, o.latestValue)) ?? false;
                    },
                });
            }),
        );
    };
}
