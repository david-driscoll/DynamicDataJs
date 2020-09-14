import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { combineCache } from './combineCache';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';

/**
 * Apply a logical Xor operator between the collections.
 * Items which are only in one of the sources are included in the result
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param items The items
 */
export function xor<TObject, TKey>(items: ArrayOrIterable<Observable<IChangeSet<TObject, TKey>>>) {
    return combineCache('xor', items);
}
