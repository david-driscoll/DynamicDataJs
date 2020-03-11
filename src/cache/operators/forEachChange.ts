import { Change } from '../Change';
import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { tap } from 'rxjs/operators';

/**
 * Provides a call back for each change
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param action The action.
 */
export function forEachChange<TObject, TKey>(action: (change: Change<TObject, TKey>) => void): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function forEachChangeOperator(source) {
        return source.pipe(tap(changes => changes.forEach(action)));
    };
}