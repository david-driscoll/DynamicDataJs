import { IChangeSet } from '../IChangeSet';
import { MonoTypeOperatorFunction } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Prepends an empty changeset to the source
 */
export function startWithEmpty<TObject, TKey>(changesSetClass: { empty<TObject, TKey>(): IChangeSet<TObject, TKey> }): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function startWithEmptyOperator(source) {
        return source.pipe(startWith(changesSetClass.empty<TObject, TKey>()));
    };
}
