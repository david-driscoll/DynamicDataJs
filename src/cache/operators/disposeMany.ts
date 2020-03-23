import { MonoTypeOperatorFunction, Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { Disposable, IDisposableOrSubscription, isDisposable, isSubscription } from '../../util';
import { Cache } from '../Cache';
import { tap } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Disposes each item when no longer required.
 * Individual items are disposed when removed or replaced. All items
 * are disposed when the stream is disposed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function disposeMany<TObject, TKey>(removeAction?: (value: TObject) => void): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    if (!removeAction) {
        removeAction = function(value: any) {
            if (isDisposable(value)) value.dispose();
            if (isSubscription(value)) value.unsubscribe();
        };
    }

    return function disposeManyOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const cache = new Cache<TObject, TKey>();
            const subscriber = source
                .pipe(tap(
                    changes => registerForRemoval(changes as any, cache),
                    e => observer.error(e),
                ))
                .subscribe(observer);

            return () => {
                subscriber.unsubscribe();

                ixFrom(cache.values()).forEach(t => removeAction!(t));
                cache.clear();
            };
        });
    };

    function registerForRemoval(changes: IChangeSet<TObject, TKey>, cache: Cache<TObject, TKey>) {
        changes.forEach(change => {
            switch (change.reason) {
                case 'update':
                    if (change.previous) removeAction!(change.previous);
                    break;
                case 'remove':
                    removeAction!(change.current);
                    break;
            }
        });
        cache.clone(changes);
    }
}