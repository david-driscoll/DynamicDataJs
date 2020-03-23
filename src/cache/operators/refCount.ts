import { MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IObservableCache } from '../IObservableCache';
import { asObservableCache } from './asObservableCache';
import { IDisposable } from '../../util';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Cache equivalent to Publish().RefCount().  The source is cached so long as there is at least 1 subscriber.
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the destination key.
 */
export function refCount<TObject, TKey>(): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function refCountOperator(source: Observable<IChangeSet<TObject, TKey>>) {
        let _refCount = 0;
        let _cache: IObservableCache<TObject, TKey>;
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            if (++_refCount === 1) {
                _cache = asObservableCache(source);
            }

            const subscriber = _cache.connect().subscribe(observer);

            return () => {

                subscriber.unsubscribe();
                let cacheToDispose: IDisposable | undefined;
                if (--_refCount == 0) {
                    cacheToDispose = _cache;
                    _cache = undefined!;
                }

                cacheToDispose?.dispose();
            };
        });
    };
}