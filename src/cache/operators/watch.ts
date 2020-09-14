import { OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { Change } from '../Change';
import { filter, mergeMap } from 'rxjs/operators';

/**
 * Returns an observable of any updates which match the specified key, preceded with the initial cache state
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param key The key.
 */
export function watch<TObject, TKey>(key: TKey): OperatorFunction<IChangeSet<TObject, TKey>, Change<TObject, TKey>> {
    return function watchOperator(source) {
        return source.pipe(
            mergeMap(updates => updates),
            filter(update => update.key === key),
        );
    };
}
