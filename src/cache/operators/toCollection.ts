import { OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { queryWhenChanged } from './queryWhenChanged';
import { map } from 'rxjs/operators';
import { toArray as ixToArray } from 'ix/iterable';

/**
 * Converts the changeset into a fully formed collection. Each change in the source results in a new collection
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function toCollection<TObject, TKey>(): OperatorFunction<IChangeSet<TObject, TKey>, TObject[]> {
    return function toCollectionOperator(source) {
        return source.pipe(
            queryWhenChanged(),
            map(query => ixToArray(query.values())),
        );
    };
}
