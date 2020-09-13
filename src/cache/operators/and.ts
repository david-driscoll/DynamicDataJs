import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { combineCache } from './combineCache';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';

/**
 * Applied a logical And operator between the collections i.e items which are in all of the sources are included
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param items The items
 */
export function and<TObject, TKey>(items: ArrayOrIterable<Observable<IChangeSet<TObject, TKey>>>) {
    return combineCache('and', items);
}
