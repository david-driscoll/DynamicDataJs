import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { tap } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { filter as ixFilter } from 'ix/iterable/operators';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Callback for each item as and when it is being added to the stream
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param addAction The add action.
 */
export function onItemAdded<TObject, TKey>(action: (value: TObject) => void): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function onItemAddedOperator(source) {
        return source
            .pipe(
                tap(changes => ixFrom(changes).pipe(ixFilter(x => x.reason === 'add')).forEach(change => action(change.current))),
            );
    };
}