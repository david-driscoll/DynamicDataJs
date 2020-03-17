import { CompositeDisposable, IDisposableOrSubscription } from '../../util';
import { ConnectableObservable, MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { publish } from 'rxjs/operators';
import { transform } from './transform';
import { disposeMany } from './disposeMany';

/**
 * Subscribes to each item when it is added to the stream and unsubcribes when it is removed.  All items will be unsubscribed when the stream is disposed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param subscriptionFactory The subsription function
 */
export function subscribeMany<TObject, TKey>(
    subscriptionFactory: (value: TObject, key: TKey) => IDisposableOrSubscription,
): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {
    return function subscribeManyOperator(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const published: ConnectableObservable<IChangeSet<TObject, TKey>> = source.pipe(publish()) as any;
            const subscriptions = published
                .pipe(
                    transform((c, k, p) => subscriptionFactory(c, k)),
                    disposeMany(),
                )
                .subscribe();

            return new CompositeDisposable(subscriptions, published.subscribe(observer), published.connect());
        });
    };
}