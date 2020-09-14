import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { map } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { filter as ixFilter } from 'ix/iterable/operators';
import { ChangeSet } from '../ChangeSet';
import { notEmpty } from './notEmpty';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Ignores the update when the condition is met.
 * The first parameter in the ignore function is the current value and the second parameter is the previous value
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param ignoreFunction The ignore function (current,previous)=>{ return true to ignore }.
 */
export function ignoreUpdateWhen<TObject, TKey>(ignoreFunction: (current: TObject, previous: TObject) => boolean): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function ignoreUpdateWhenOperator(source) {
        return source.pipe(
            map(updates => {
                const result = ixFrom(updates).pipe(
                    ixFilter(u => {
                        if (u.reason !== 'update') return true;
                        return !ignoreFunction(u.current, u.previous!);
                    }),
                );
                return new ChangeSet(result);
            }),
            notEmpty(),
        );
    };
}
