import { MonoTypeOperatorFunction } from 'rxjs';
import { ISortedChangeSet } from '../ISortedChangeSet';
import { IChangeSet } from '../IChangeSet';
import { Change } from '../Change';
import { map } from 'rxjs/operators';
import { SortedChangeSet } from '../SortedChangeSet';

/**
 * Converts moves changes to remove + add
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function treatMovesAsRemoveAdd<TObject, TKey>(): MonoTypeOperatorFunction<ISortedChangeSet<TObject, TKey>> {
    function* replaceMoves(items: IChangeSet<TObject, TKey>): Iterable<Change<TObject, TKey>> {
        for (const change of items) {
            if (change.reason === 'moved') {
                yield new Change<TObject, TKey>('remove', change.key, change.current, change.previousIndex);
                yield new Change<TObject, TKey>('add', change.key, change.current, change.currentIndex);
            } else {
                yield change;
            }
        }
    }

    return function treatMovesAsRemoveAddOperator(source) {
        return source.pipe(map(changes => new SortedChangeSet<TObject, TKey>(changes.sortedItems, replaceMoves(changes))));
    };
}
