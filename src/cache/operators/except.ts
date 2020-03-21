import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { combineCache } from './combineCache';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';

/**
 * Dynamically apply a logical Except operator between the collections
 * Items from the first collection in the outer list are included unless contained in any of the other lists
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param items The items
 */
export function except<TObject, TKey>(items: ArrayOrIterable<Observable<IChangeSet<TObject, TKey>>>) {
    return combineCache('except', items);
}