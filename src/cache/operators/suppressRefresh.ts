import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { whereReasonsAreNot } from './whereReasonsAreNot';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Suppress refresh notifications
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function suppressRefresh<TObject, TKey>(): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function suppressRefreshOperator(source) {
        return source.pipe(whereReasonsAreNot('refresh'));
    };
}
