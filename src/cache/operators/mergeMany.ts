import { Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { subscribeMany } from './subscribeMany';

/**
 * Dynamically merges the observable which is selected from each item in the stream, and unmerges the item
 * when it is no longer part of the stream.
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TDestination The type of the destination.
 * @param observableSelector The observable selector.
 */
export function mergeMany<TObject, TKey, TDestination>(
    observableSelector: (value: TObject, key: TKey) => Observable<TDestination>,
): OperatorFunction<IChangeSet<TObject, TKey>, TDestination> {
    return function mergeManyOperator(source) {
        return new Observable<TDestination>(observer => {
            return source.pipe(subscribeMany((t, v) => observableSelector(t, v).subscribe(x => observer.next(x)))).subscribe(
                x => {
                },
                ex => observer.error(ex),
                // TODO: Is this needed
                () => observer.complete(),
            );
        });
    };
}