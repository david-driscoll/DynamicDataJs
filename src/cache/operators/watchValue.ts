import { IObservableCache, isObservableCache } from '../IObservableCache';
import { map } from 'rxjs/operators';
import { Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { watch } from './watch';

/**
 * Watches updates for a single value matching the specified key
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param cache The cache.
 * @param key The key.
 */
export function watchValue<TObject, TKey>(cache: IObservableCache<TObject, TKey>, key: TKey): Observable<TObject>;
/**
 * Watches updates for a single value matching the specified key
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param key The key.
 */
export function watchValue<TObject, TKey>(key: TKey): OperatorFunction<IChangeSet<TObject, TKey>, TObject>;
export function watchValue<TObject, TKey>(cache: IObservableCache<TObject, TKey> | TKey, key?: TKey) {
    if (isObservableCache(cache)) {
        return cache.watch(key!).pipe(map(z => z.current));
    } else {
        key = cache;
        return function watchValueOperator(source: Observable<IChangeSet<TObject, TKey>>) {
            return source.pipe(
                watch(key),
                map(z => z.current),
            );
        };
    }
}
