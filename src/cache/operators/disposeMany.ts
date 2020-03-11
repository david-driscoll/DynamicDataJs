import { MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { Disposable, isDisposable, isSubscription } from '../../util';
import { Cache } from '../Cache';
import { tap } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';

/**
 * Disposes each item when no longer required.
 * Individual items are disposed when removed or replaced. All items
 * are disposed when the stream is disposed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 */
export function disposeMany<TObject, TKey>(removeAction?: (value: TObject) => void): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    if (!removeAction) {
        removeAction = function(value: TObject) {
            if (isDisposable(value)) value.dispose();
            if (isSubscription(value)) value.unsubscribe();
        };
    }

    return function disposeManyOperator(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const cache = new Cache<TObject, TKey>();
            const subscriber = source.pipe(tap(changes => registerForRemoval(changes, cache), observer.error)).subscribe(observer);

            return Disposable.create(() => {
                subscriber.unsubscribe();

                ixFrom(cache.values()).forEach(t => removeAction!(t));
                cache.clear();
            });
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