import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { whereReasonsAreNot } from './whereReasonsAreNot';

/**
 * Supress  refresh notifications
 */
export function suppressRefresh<TObject, TKey>(): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function supressRefreshOperator(source) {
        return source.pipe(whereReasonsAreNot('refresh'));
    };
}