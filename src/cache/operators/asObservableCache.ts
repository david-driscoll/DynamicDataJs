import { ObservableCache } from '../ObservableCache';
import { IObservableCache } from '../IObservableCache';
import { isObservable, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';

/**
 * Converts the source to an read only observable cache
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 * @param source The source
 */
export function asObservableCache<TObject, TKey>(source: IObservableCache<TObject, TKey>): IObservableCache<TObject, TKey>;
/**
 * Converts the source to an read only observable cache
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 * @param source The source
 */
export function asObservableCache<TObject, TKey>(source: Observable<IChangeSet<TObject, TKey>>): IObservableCache<TObject, TKey>;
export function asObservableCache<TObject, TKey>(source: IObservableCache<TObject, TKey> | Observable<IChangeSet<TObject, TKey>>): IObservableCache<TObject, TKey> {
    if (isObservable(source)) {
        return new ObservableCache(source);
    } else {
        return source;
    }
}

