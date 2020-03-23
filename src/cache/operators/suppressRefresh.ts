import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { whereReasonsAreNot } from './whereReasonsAreNot';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Supress  refresh notifications
 */
export function suppressRefresh<TObject, TKey>(): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function supressRefreshOperator(source) {
        return source.pipe(whereReasonsAreNot('refresh'));
    };
}