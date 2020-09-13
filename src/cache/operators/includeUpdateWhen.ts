import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { map } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { filter as ixFilter } from 'ix/iterable/operators';
import { ChangeSet } from '../ChangeSet';
import { notEmpty } from './notEmpty';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Only includes the update when the condition is met.
 * The first parameter in the ignore function is the current value and the second parameter is the previous value
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param includeFunction The include function (current,previous)=>{ return true to include }.
 */
export function includeUpdateWhen<TObject, TKey>(includeFunction: (current: TObject, previous: TObject) => boolean): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function includeUpdateWhenOperator(source) {
        return source.pipe(
            map(updates => {
                const result = ixFrom(updates).pipe(
                    ixFilter(u => {
                        return u.reason !== 'update' || includeFunction(u.current, u.previous!);
                    }),
                );
                return new ChangeSet(result);
            }),
            notEmpty(),
        );
    };
}
