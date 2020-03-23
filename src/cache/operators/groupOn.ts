import { ConnectableObservable, merge, NEVER, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { Group, GroupChangeSet, ManagedGroup } from '../IGroupChangeSet';
import { filter, finalize, map, publish } from 'rxjs/operators';
import { disposeMany } from './disposeMany';
import { ChangeReason } from '../ChangeReason';
import { Change } from '../Change';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { map as ixMap } from 'ix/Ix.dom.iterable.operators';
import { ChangeSet } from '../ChangeSet';
import { ArrayOrIterable } from '../../util/ArrayOrIterable';
import { groupBy as ixGroupBy } from 'ix/iterable/operators';
import { ChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 *  Groups the source on the value returned by group selector factory.
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TGroupKey The type of the group key.
 * @param groupSelectorKey The group selector key.
 * @param regrouper Invoke to  the for the grouping to be re-evaluated
 */
export function groupOn<TObject, TKey, TGroupKey>(
    groupSelectorKey: (value: TObject) => TGroupKey,
    regrouper: Observable<unknown> = NEVER): ChangeSetOperatorFunction<TObject, TKey, Group<TObject, TKey, TGroupKey>, TGroupKey> {

    return function groupOnOperator(source) {

        const _groupCache = new Map<TGroupKey, ManagedGroup<TObject, TKey, TGroupKey>>();
        const _itemCache = new Map<TKey, ChangeWithGroup>();

        return new Observable<IChangeSet<Group<TObject, TKey, TGroupKey>, TGroupKey>>(observer => {
            const groups = source
                .pipe(
                    finalize(() => observer.complete()),
                    map(x => update(x)),
                    filter(z => z.size !== 0),
                );

            const regroup$ = regrouper
                .pipe(
                    map(x => regroup()),
                    filter(z => z.size !== 0),
                );

            const published: ConnectableObservable<IChangeSet<Group<TObject, TKey, TGroupKey>, TGroupKey>> = merge(groups, regroup$).pipe(publish()) as any;
            const subscriber = published.subscribe(observer);
            const disposer = published.pipe(disposeMany()).subscribe();

            const connected = published.connect();

            return () => {
                connected.unsubscribe();
                disposer.unsubscribe();
                subscriber.unsubscribe();
            };
        });

        function update(updates: IChangeSet<TObject, TKey>): IChangeSet<Group<TObject, TKey, TGroupKey>, TGroupKey> {
            return handleUpdates(updates);
        }

        type ChangeWithGroup = { item: TObject; key: TKey; groupKey: TGroupKey; reason: ChangeReason; };

        function createChangeWithGroup(change: Change<TObject, TKey>): ChangeWithGroup {
            return {
                key: change.key,
                item: change.current,
                reason: change.reason,
                groupKey: groupSelectorKey(change.current),
            };
        }

        function regroup() {
            //re-evaluate all items in the group
            const items = ixFrom(_itemCache.entries())
                .pipe(ixMap(([key, value]) => new Change<TObject, TKey>('refresh', key, value.item)));
            return handleUpdates(new ChangeSet<TObject, TKey>(items), true);
        }

        function getCache(key: TGroupKey): [ManagedGroup<TObject, TKey, TGroupKey>, boolean] {
            const cache = _groupCache.get(key);
            if (cache !== undefined) {
                return [cache, false];
            }

            const newcache = new ManagedGroup<TObject, TKey, TGroupKey>(key);
            _groupCache.set(key, newcache);
            return [newcache, true];
        }

        function handleUpdates(changes: ArrayOrIterable<Change<TObject, TKey>>, isRegrouping = false) {
            const result: Change<Group<TObject, TKey, TGroupKey>, TGroupKey>[] = [];

            //Group all items
            const grouped = ixFrom(changes)
                .pipe(
                    ixMap(createChangeWithGroup),
                    ixGroupBy(z => z.groupKey),
                );

            //1. iterate and maintain child caches (_groupCache)
            //2. maintain which group each item belongs to (_itemCache)
            grouped.forEach(group => {
                let [groupCache, created] = getCache(group.key);
                if (created) {
                    result.push(new Change<Group<TObject, TKey, TGroupKey>, TGroupKey>('add', group.key, groupCache));
                }

                groupCache.update(groupUpdater => {
                    for (const current of group) {
                        switch (current.reason) {
                            case 'add': {
                                groupUpdater.addOrUpdate(current.item, current.key);
                                _itemCache.set(current.key, current);
                                break;
                            }

                            case 'update': {
                                groupUpdater.addOrUpdate(current.item, current.key);

                                //check whether the previous item was in a different group. If so remove from old group
                                const previous = _itemCache.get(current.key);
                                if (previous === undefined)
                                    throw new Error(`${current.key} is missing from previous value on update.`);

                                if (previous.groupKey !== current.groupKey) {
                                    const g = _groupCache.get(previous.groupKey);
                                    if (g !== undefined) {
                                        g.update(u => u.removeKey(current.key));
                                        if (g.size === 0) {
                                            _groupCache.delete(g.key);
                                            result.push(new Change<Group<TObject, TKey, TGroupKey>, TGroupKey>('remove', g.key, g));
                                        }
                                    }

                                    _itemCache.set(current.key, current);
                                }

                                break;
                            }

                            case 'remove': {
                                const previousInSameGroup = groupUpdater.lookup(current.key);
                                if (previousInSameGroup !== undefined) {
                                    groupUpdater.removeKey(current.key);
                                } else {
                                    //this has been removed due to an underlying evaluate resulting in a remove
                                    const previousGroupKey = _itemCache.get(current.key)?.groupKey;
                                    if (previousGroupKey === undefined) {
                                        return new Error(`${current.key} is missing from previous value on remove.`);
                                    }

                                    const g = _groupCache.get(previousGroupKey);
                                    if (g !== undefined) {
                                        g.update(u => u.removeKey(current.key));
                                        if (g.size === 0) {
                                            _groupCache.delete(g.key);
                                            result.push(new Change<Group<TObject, TKey, TGroupKey>, TGroupKey>('remove', g.key, g));
                                        }
                                    }
                                }

                                //finally, remove the current item from the item cache
                                _itemCache.delete(current.key);

                                break;
                            }

                            case 'refresh': {
                                //check whether the previous item was in a different group. If so remove from old group
                                const p = _itemCache.get(current.key);

                                if (p !== undefined) {
                                    if (p.groupKey === current.groupKey) {
                                        //propagate evaluates up the chain
                                        if (!isRegrouping) {
                                            groupUpdater.refreshKey(current.key);
                                        }
                                    } else {
                                        const g = _groupCache.get(p.groupKey);
                                        if (g !== undefined) {
                                            g.update(u => u.removeKey(current.key));
                                            if (g.size === 0) {
                                                _groupCache.delete(g.key);
                                                result.push(new Change<Group<TObject, TKey, TGroupKey>, TGroupKey>('remove', g.key, g));
                                            }
                                        }
                                        groupUpdater.addOrUpdate(current.item, current.key);
                                    }
                                } else {
                                    //must be created due to addition
                                    groupUpdater.addOrUpdate(current.item, current.key);
                                }

                                _itemCache.set(current.key, current);

                                break;
                            }
                        }
                    }
                });

                if (groupCache.cache.size === 0) {
                    if (_groupCache.has(group.key))
                        _groupCache.delete(group.key);
                    result.push(new Change<Group<TObject, TKey, TGroupKey>, TGroupKey>('remove', group.key, groupCache));
                }
            });

            return new GroupChangeSet<TObject, TKey, TGroupKey>(result);
        }
    };
}

