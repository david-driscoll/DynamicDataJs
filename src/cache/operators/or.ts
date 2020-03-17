import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { combineCache } from './combineCache';

/**
 * Apply a logical Or operator between the collections i.e items which are in any of the sources are included
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param items The items
 */
export function or<TObject, TKey>(...items: Observable<IChangeSet<TObject, TKey>>[]) {
    return combineCache('or', ...items);
}