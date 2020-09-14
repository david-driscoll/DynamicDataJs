import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { CompositeDisposable, Disposable, IDisposable } from '../../util';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { toArray, toArray as ixToArray } from 'ix/iterable/toarray';
import { range as ixRange } from 'ix/iterable/range';
import { map as ixMap } from 'ix/iterable/operators/map';
import { Cache } from '../Cache';
import { count, every, first, some, zip as ixZip } from 'ix/iterable';
import { from as ixFrom } from 'ix/iterable/from';
import { filter as ixFilter, skip, take } from 'ix/iterable/operators';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';

/**
 * Combine a set of observables into a cache
 * @category Operator
 * @param operator the operator to use for combining
 * @param items The list of observables that will be combined
 */
export function combineCache<TObject, TKey>(operator: CombineOperator, items: ArrayOrIterable<Observable<IChangeSet<TObject, TKey>>>): Observable<IChangeSet<TObject, TKey>> {
    return new Observable<IChangeSet<TObject, TKey>>(observer => {
        function updateAction(updates: IChangeSet<TObject, TKey>) {
            try {
                observer.next(updates);
            } catch (error) {
                observer.error(error);
                observer.complete();
            }
        }

        let subscriber: IDisposable = Disposable.empty;
        try {
            subscriber = combiner(operator, updateAction, toArray(items));
        } catch (error) {
            observer.error(error);
            observer.complete();
        }
        return () => subscriber.dispose();
    });
}

export type CombineOperator = 'and' | 'or' | 'xor' | 'except';

function combiner<TObject, TKey>(type: CombineOperator, updatedCallback: (changes: IChangeSet<TObject, TKey>) => void, items: Observable<IChangeSet<TObject, TKey>>[]) {
    const _combinedCache = new ChangeAwareCache<TObject, TKey>();

    //subscribe
    const disposable = new CompositeDisposable();
    const caches = ixToArray(ixRange(0, items.length).pipe(ixMap(_ => new Cache<TObject, TKey>())));

    for (const [item, cache] of ixZip(items, caches)) {
        const subscription = item.subscribe(updates => update(cache, updates));
        disposable.add(subscription);
    }

    return disposable;

    function update(cache: Cache<TObject, TKey>, updates: IChangeSet<TObject, TKey>) {
        //update cache for the individual source
        cache.clone(updates);

        //update combined
        const notifications = updateCombined(updates);

        if (notifications.size !== 0) {
            updatedCallback(notifications);
        }
    }

    function updateCombined(updates: IChangeSet<TObject, TKey>): IChangeSet<TObject, TKey> {
        //child caches have been updated before we reached this point.

        for (const update of updates) {
            const key = update.key;
            switch (update.reason) {
                case 'add':
                case 'update':
                    {
                        // get the current key.
                        // check whether the item should belong to the cache
                        const cached = _combinedCache.lookup(key);
                        const contained = cached !== undefined;
                        const match = matchesConstraint(key);

                        if (match) {
                            if (contained) {
                                if (update.current !== cached) {
                                    _combinedCache.addOrUpdate(update.current, key);
                                }
                            } else {
                                _combinedCache.addOrUpdate(update.current, key);
                            }
                        } else {
                            if (contained) {
                                _combinedCache.removeKey(key);
                            }
                        }
                    }

                    break;

                case 'remove':
                    {
                        const cached = _combinedCache.lookup(key);
                        const contained = cached !== undefined;
                        const shouldBeIncluded = matchesConstraint(key);

                        if (shouldBeIncluded) {
                            const firstOne = first(
                                ixFrom(caches).pipe(
                                    ixMap(s => s.lookup(key)),
                                    ixFilter(z => z !== undefined),
                                ),
                            )!;

                            if (cached === undefined) {
                                _combinedCache.addOrUpdate(firstOne, key);
                            } else if (firstOne !== cached) {
                                _combinedCache.addOrUpdate(firstOne, key);
                            }
                        } else {
                            if (contained) {
                                _combinedCache.removeKey(key);
                            }
                        }
                    }

                    break;

                case 'refresh':
                    {
                        _combinedCache.refreshKey(key);
                    }

                    break;
            }
        }

        return _combinedCache.captureChanges();
    }

    function matchesConstraint(key: TKey): boolean {
        const predicate = { predicate: (s: Cache<any, TKey>) => s.lookup(key) !== undefined };
        switch (type) {
            case 'and': {
                return every(caches, predicate);
            }

            case 'or': {
                return some(caches, predicate);
            }

            case 'xor': {
                return count(caches, predicate) == 1;
            }

            case 'except': {
                const first = some(ixFrom(caches).pipe(take(1)), predicate);
                const others = some(ixFrom(caches).pipe(skip(1)), predicate);
                return first && !others;
            }
        }
    }
}
