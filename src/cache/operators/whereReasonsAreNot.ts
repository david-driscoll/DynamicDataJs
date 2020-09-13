import { ChangeReason } from '../ChangeReason';
import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { map } from 'rxjs/operators';
import { ChangeSet } from '../ChangeSet';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { filter as ixFilter } from 'ix/iterable/operators';
import { notEmpty } from './notEmpty';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Excludes updates for the specified reasons
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param reasons The reasons.
 */
export function whereReasonsAreNot<TObject, TKey>(...reasons: ChangeReason[]): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function onItemUpdatedOperator(source) {
        return source.pipe(
            map(updates => new ChangeSet(ixFrom(updates).pipe(ixFilter(x => !reasons.includes(x.reason))))),
            notEmpty(),
        );
    };
}
