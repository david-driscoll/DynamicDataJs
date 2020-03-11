import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { tap } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { filter as ixFilter } from 'ix/iterable/operators';

/**
 * Callback when an item has been updated eg. (current, previous)=>{}
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param action The update action.
 */
export function onItemUpdated<TObject, TKey>(action: (value: TObject) => void): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function onItemUpdatedOperator(source) {
        return source
            .pipe(
                tap(changes => ixFrom(changes).pipe(ixFilter(x => x.reason === 'update')).forEach(change => action(change.current))),
            );
    };
}