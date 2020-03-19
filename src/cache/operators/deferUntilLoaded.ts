import { IObservableCache } from '../IObservableCache';
import { concat, MonoTypeOperatorFunction, Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { ChangeSet } from '../ChangeSet';
import { notEmpty } from './notEmpty';
import { IChangeSet } from '../IChangeSet';
import { statusMonitor } from './statusMonitor';

/**
 * Defer the subscription until the stream has been inflated with data
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function deferUntilLoaded<TObject, TKey>(source: IObservableCache<TObject, TKey>): Observable<IChangeSet<TObject, TKey>>;
/**
 * Defer the subscription until the stream has been inflated with data
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function deferUntilLoaded<TObject, TKey>(): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>;
export function deferUntilLoaded<TObject, TKey>(source?: IObservableCache<TObject, TKey>) {
    if (source !== undefined) {
        return concat(
            source.countChanged
                .pipe(
                    filter(count => count != 0),
                    take(1),
                    map(_ => new ChangeSet<TObject, TKey>()),
                ), source.connect(),
        ).pipe(notEmpty());
    }
    return function deferUntilLoadedOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        return concat(source
            .pipe(
                statusMonitor(),
                filter(status => status == 'loaded'),
                take(1),
                map(_ => new ChangeSet<TObject, TKey>()),
            ), source)
            .pipe(notEmpty());
    };
}