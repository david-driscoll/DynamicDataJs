import { IChangeSet } from '../IChangeSet';
import { MonoTypeOperatorFunction } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Prepends an empty changeset to the source
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param changesSetClass the class that defines the changeset
 */
export function startWithEmpty<TObject, TKey>(changesSetClass: { empty<TObject, TKey>(): IChangeSet<TObject, TKey> }): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function startWithEmptyOperator(source) {
        return source.pipe(startWith(changesSetClass.empty<TObject, TKey>()));
    };
}
