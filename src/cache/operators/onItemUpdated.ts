import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { tap } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { filter as ixFilter } from 'ix/iterable/operators';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Callback when an item has been updated eg. (current, previous)=>{}
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param action The update action.
 */
export function onItemUpdated<TObject, TKey>(action: (current: TObject, previous: TObject) => void): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function onItemUpdatedOperator(source) {
        return source.pipe(
            tap(changes =>
                ixFrom(changes)
                    .pipe(ixFilter(x => x.reason === 'update'))
                    .forEach(change => action(change.current, change.previous!)),
            ),
        );
    };
}
