import { IChangeSet } from '../IChangeSet';
import { MonoTypeOperatorFunction } from 'rxjs';
import { startWith } from 'rxjs/operators';

/**
 * Prepends an empty changeset to the source
 */
export function startWithEmpty<TChangeSet extends IChangeSet<TObject, TKey>, TObject, TKey>(changesSetClass: { empty<TObject, TKey>(): TChangeSet }): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function startWithEmptyOperator(source) {
        return source.pipe(startWith(changesSetClass.empty<TObject, TKey>()));
    };
}