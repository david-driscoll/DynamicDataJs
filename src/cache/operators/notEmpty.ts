import { MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { filter } from 'rxjs/operators';


/**
 * Supresses updates which are empty
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function notEmpty<TObject, TKey>(): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function notEmptyOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        return source.pipe(filter(changes => changes.size !== 0));
    };
}

