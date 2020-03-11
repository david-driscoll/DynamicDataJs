import { Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { subscribeMany } from './subscribeMany';
import { map } from 'rxjs/operators';

export type ItemWithValue<TObject, TValue> = { item: TObject; value: TValue };

/**
 * Dynamically merges the observable which is selected from each item in the stream, and unmerges the item
 * when it is no longer part of the stream.
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TDestination The type of the destination.
 * @param observableSelector The observable selector.
 */
export function mergeManyItems<TObject, TKey, TDestination>(
    observableSelector: (value: TObject, key: TKey) => Observable<TDestination>,
): OperatorFunction<IChangeSet<TObject, TKey>, ItemWithValue<TObject, TDestination>> {
    return function mergeManyItemsOperator(source) {
        return new Observable<ItemWithValue<TObject, TDestination>>(observer => {
            return source
                .pipe(
                    subscribeMany((t, v) =>
                        observableSelector(t, v)
                            .pipe(map(z => ({ item: t, value: z })))
                            .subscribe(observer),
                    ),
                )
                .subscribe();
        });
    };
}