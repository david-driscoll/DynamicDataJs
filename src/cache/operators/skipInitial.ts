import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { deferUntilLoaded } from './deferUntilLoaded';
import { skip } from 'rxjs/operators';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Defer the subscribtion until loaded and skip initial changeset
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function skipInitial<TObject, TKey>(): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function skipInitialOperator(source) {
        return source.pipe(deferUntilLoaded(), skip(1));
    };
}