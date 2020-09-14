import { CompositeDisposable, IDisposableOrSubscription } from '../../util';
import { ConnectableObservable, MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { publish } from 'rxjs/operators';
import { transform } from './transform';
import { disposeMany } from './disposeMany';
import { IPagedChangeSet } from '../IPagedChangeSet';
import { ISortedChangeSet } from '../ISortedChangeSet';
import { DistinctChangeSet } from '../DistinctChangeSet';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Subscribes to each item when it is added to the stream and unsubscribes when it is removed.  All items will be unsubscribed when the stream is disposed
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param subscriptionFactory The subscription function
 */
export function subscribeMany<TObject, TKey>(subscriptionFactory: (value: TObject, key: TKey) => IDisposableOrSubscription): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function subscribeManyOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const published = publish<IChangeSet<TObject, TKey>>()(source);
            const subscriptions = published.pipe(transform(subscriptionFactory), disposeMany()).subscribe();

            return new CompositeDisposable(subscriptions, published.subscribe(observer), published.connect());
        });
    };
}
