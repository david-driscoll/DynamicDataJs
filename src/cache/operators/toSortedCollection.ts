import { OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { queryWhenChanged } from './queryWhenChanged';
import { map } from 'rxjs/operators';
import { from as ixFrom, toArray as ixToArray } from 'ix/Ix.dom.iterable';
import { orderBy, orderByDescending } from 'ix/iterable/operators';

/**
 * Converts the changeset into a fully formed sorted collection. Each change in the source results in a new sorted collection
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TSortKey The sort key
 * @param sortSelector The sort function
 * @param sortOrder The sort order. Defaults to ascending
 */
export function toSortedCollection<TObject, TKey, TSortKey>(
    sortSelector: (value: TObject) => TSortKey,
    sortOrder?: 'asc' | 'desc',
): OperatorFunction<IChangeSet<TObject, TKey>, TObject[]>;
/**
 * Converts the changeset into a fully formed sorted collection. Each change in the source results in a new sorted collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TSortKey The sort key
 * @param sortSelector The sort function
 * @param comparer The sort comparer
 * @param sortOrder The sort order. Defaults to ascending
 */
export function toSortedCollection<TObject, TKey, TSortKey>(
    sortSelector: (value: TObject) => TSortKey,
    comparer: (a: TSortKey, b: TSortKey) => number,
    sortOrder?: 'asc' | 'desc',
): OperatorFunction<IChangeSet<TObject, TKey>, TObject[]>;
export function toSortedCollection<TObject, TKey, TSortKey>(
    sortSelector: (value: TObject) => TSortKey,
    comparerOrSortOrder?: ((a: TSortKey, b: TSortKey) => number) | 'asc' | 'desc',
    sortOrder: 'asc' | 'desc' = 'asc',
): OperatorFunction<IChangeSet<TObject, TKey>, TObject[]> {
    let comparer: ((a: TSortKey, b: TSortKey) => number) | undefined;
    if (typeof comparerOrSortOrder === 'string') {
        sortOrder = comparerOrSortOrder;
    } else {
        comparer = comparerOrSortOrder;
    }
    return function toSortedCollectionOperator(source) {
        return source.pipe(
            queryWhenChanged(),
            map(query => ixToArray(ixFrom(query.values()).pipe(sortOrder === 'asc' ? orderBy(sortSelector, comparer) : orderByDescending(sortSelector, comparer)))),
        );
    };
}
