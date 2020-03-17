import { Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { CompositeDisposable, Disposable, IDisposable } from '../../util';
import { ChangeAwareCache } from '../ChangeAwareCache';
import { toArray as ixToArray } from 'ix/iterable/toarray';
import { range as ixRange } from 'ix/iterable/range';
import { map as ixMap } from 'ix/iterable/operators/map';
import { Cache } from '../Cache';
import { count, every, first, some, zip as ixZip } from 'ix/iterable';
import { from as ixFrom } from 'ix/iterable/from';
import { filter as ixFilter, skip, take } from 'ix/iterable/operators';

export function combineCache<TObject, TKey>(operator: CombineOperator, ...items: Observable<IChangeSet<TObject, TKey>>[]): Observable<IChangeSet<TObject, TKey>> {
    return new Observable<IChangeSet<TObject, TKey>>(observer => {
        function updateAction(updates: IChangeSet<TObject, TKey>) {
            try {
                observer.next(updates);
            } catch (ex) {
                observer.error(ex);
                observer.complete();
            }
        }

        let subscriber: IDisposable = Disposable.empty;
        try {
            subscriber = combiner(operator, updateAction, items);
        } catch (ex) {
            observer.error(ex);
            observer.complete();
        }
        return () => subscriber.dispose();
    });
}

export type CombineOperator = 'and' | 'or' | 'xor' | 'except';

function combiner<TObject, TKey>(type: CombineOperator, updatedCallback: (changes: IChangeSet<TObject, TKey>) => void, items: Observable<IChangeSet<TObject, TKey>>[]) {
    const _combinedCache = new ChangeAwareCache<TObject, TKey>();

    //subscribe
    var disposable = new CompositeDisposable();
    const caches = ixToArray(ixRange(0, items.length).pipe(ixMap(_ => new Cache<TObject, TKey>())));

    for (var [item, cache] of ixZip(items, caches)) {
        var subscription = item.subscribe(updates => update(cache, updates));
        disposable.add(subscription);
    }

    return disposable;


    function update(cache: Cache<TObject, TKey>, updates: IChangeSet<TObject, TKey>) {
        let notifications: IChangeSet<TObject, TKey>;
        //update cache for the individual source
        cache.clone(updates);

        //update combined
        notifications = updateCombined(updates);

        if (notifications.size !== 0) {
            updatedCallback(notifications);
        }
    }

    function updateCombined(updates: IChangeSet<TObject, TKey>): IChangeSet<TObject, TKey> {
        //child caches have been updated before we reached this point.

        for (var update of updates) {
            const key = update.key;
            switch (update.reason) {
                case 'add':
                case 'update': {
                    // get the current key.
                    //check whether the item should belong to the cache
                    var cached = _combinedCache.lookup(key);
                    var contained = cached !== undefined;
                    var match = matchesConstraint(key);

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
                            _combinedCache.remove(key);
                        }
                    }
                }

                    break;

                case 'remove': {
                    var cached = _combinedCache.lookup(key);
                    var contained = cached !== undefined;
                    const shouldBeIncluded = matchesConstraint(key);

                    if (shouldBeIncluded) {
                        const firstOne = first(ixFrom(caches).pipe(
                            ixMap(s => s.lookup(key)),
                            ixFilter(z => z !== undefined),
                        ))!;

                        if (cached !== undefined) {
                            _combinedCache.addOrUpdate(firstOne, key);
                        } else if (firstOne !== cached) {
                            _combinedCache.addOrUpdate(firstOne, key);
                        }
                    } else {
                        if (contained) {
                            _combinedCache.remove(key);
                        }
                    }
                }

                    break;

                case 'refresh': {
                    _combinedCache.refresh(key);
                }

                    break;
            }
        }

        return _combinedCache.captureChanges();
    }

    function matchesConstraint(key: TKey): boolean {
        switch (type) {
            case 'and': {
                return every(caches, s => s.lookup(key) !== undefined);
            }

            case 'or': {
                return some(caches, s => s.lookup(key) !== undefined);
            }

            case 'xor': {
                return count(caches, s => s.lookup(key) !== undefined) == 1;
            }

            case 'except': {
                const first = some(ixFrom(caches).pipe(take(1)), s => s.lookup(key) !== undefined);
                const others = some(ixFrom(caches).pipe(skip(1)), s => s.lookup(key) !== undefined);
                return first && !others;
            }
        }
    }
}
