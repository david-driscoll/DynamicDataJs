import { MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { IntermediateCache } from '../IntermediateCache';
import { transform } from './transform';
import { ExpirableItem } from '../ExpirableItem';
import { finalize, map } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { filter as ixFilter, orderByDescending } from 'ix/iterable/operators';
import { Disposable } from '../../util';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { skip as ixSkip } from 'ix/iterable/operators/skip';
import { map as ixMap } from 'ix/iterable/operators/map';
import { Change } from '../Change';
import { some } from 'ix/iterable';
import { ChangeSet } from '../ChangeSet';
import { toArray as ixToArray } from 'ix/iterable/toarray';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Applies a size limiter to the number of records which can be included in the
 * underlying cache.  When the size limit is reached the oldest items are removed.
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param size The size.
 */
export function limitSizeTo<TObject, TKey>(size: number): MonoTypeChangeSetOperatorFunction<TObject, TKey> {
    return function limitSizeToOperaor(source) {
        return new Observable<IChangeSet<TObject, TKey>>(observer => {
            const sizeLimiter = new SizeLimiter<TObject, TKey>(size);
            const root = new IntermediateCache<TObject, TKey>(source);

            const subscriber = root
                .connect()
                .pipe(
                    transform((value, key) => {
                        return <ExpirableItem<TObject, TKey>>{ expireAt: Date.now(), value, key };
                    }),
                    map(changes => {
                        const result = sizeLimiter.change(changes);

                        const removes = ixFrom(result).pipe(ixFilter(c => c.reason === 'remove'));
                        root.edit(updater => removes.forEach(c => updater.removeKey(c.key)));
                        return result;
                    }),
                    finalize(() => observer.complete()),
                )
                .subscribe(observer);

            return Disposable.create(() => {
                subscriber.unsubscribe();
                root.dispose();
            });
        });
    };
}

class SizeLimiter<TObject, TKey> {
    private readonly _cache = new ChangeAwareCache<ExpirableItem<TObject, TKey>, TKey>();

    private readonly _sizeLimit: number;

    public constructor(size: number) {
        this._sizeLimit = size;
    }

    public change(updates: IChangeSet<ExpirableItem<TObject, TKey>, TKey>): IChangeSet<TObject, TKey> {
        this._cache.clone(updates);

        const itemstoexpire = ixToArray(
            ixFrom(this._cache.entries()).pipe(
                orderByDescending(([key, value]) => value.expireAt),
                ixSkip(this._sizeLimit),
                ixMap(([key, value]) => Change.remove(key, value.value)),
            ),
        );

        if (itemstoexpire.length > 0) {
            this._cache.removeKeys(itemstoexpire.map(z => z.key));
        }

        const notifications = this._cache.captureChanges();
        const changed = ixFrom(notifications).pipe(
            ixMap(update => ({
                ...update,
                current: update.current.value,
                previous: update.previous?.value,
            })),
        );

        return new ChangeSet<TObject, TKey>(changed);
    }

    public cloneAndReturnExpiredOnly(updates: IChangeSet<ExpirableItem<TObject, TKey>, TKey>): TKey[] {
        this._cache.clone(updates);
        this._cache.captureChanges(); //Clear any changes

        return ixToArray(
            ixFrom(this._cache.entries()).pipe(
                orderByDescending(([key, value]) => value.expireAt),
                ixSkip(this._sizeLimit),
                ixMap(x => x[0]),
            ),
        );
    }
}
