import { combineLatest, Observable, OperatorFunction } from 'rxjs';
import { DistinctChangeSet } from '../DistinctChangeSet';
import { IChangeSet } from '../IChangeSet';
import { Group, GroupChangeSet, ManagedGroup } from '../IGroupChangeSet';
import { map, mergeAll, startWith, switchMap, tap } from 'rxjs/operators';
import { disposeMany } from './disposeMany';
import { asObservableCache } from './asObservableCache';
import { subscribeMany } from './subscribeMany';
import { transform } from './transform';
import { from as ixFrom, toSet } from 'ix/iterable';
import { map as ixMap, filter as ixFilter, tap as ixTap } from 'ix/iterable/operators';
import { Change } from '../Change';
import { CompositeDisposable, Disposable } from '../../util';
import { groupOn } from './groupOn';
import { filter } from './filter';
import { toCollection } from './toCollection';
import { bind } from './bind';
import { clone } from './clone';
import { ChangeSet } from '../ChangeSet';

/**
 *   Groups the source on the value returned by group selector factory.
 *   A group is included for each item in the resulting group source.
 * @typeparam TObject">The type of the object
 * @typeparam TKey">The type of the key
 * @typeparam TGroupKey">The type of the group key
 * @param groupSelector The group selector factory.
 * @param resultGroupSource A distinct stream used to determine the result
 * @summary Useful for parent-child collection when the parent and child are soured from different streams
 **/
export function groupOnDistinct<TObject, TKey, TGroupKey>(
    groupSelector: (value: TObject) => TGroupKey,
    resultGroupSource: Observable<DistinctChangeSet<TGroupKey>>,
): OperatorFunction<IChangeSet<TObject, TKey>, IChangeSet<Group<TObject, TKey, TGroupKey>, TGroupKey>> {
    return function groupOnDistinctOperator(source) {
        return new Observable<IChangeSet<Group<TObject, TKey, TGroupKey>, TGroupKey>>(observer => {

            const sourceGroup$ = source
                .pipe(
                    groupOn(groupSelector),
                    disposeMany(),
                );

            //create source group cache
            const sourceGroups = asObservableCache(sourceGroup$);

            const parentGroups$ = resultGroupSource
                .pipe(transform(x => {
                        //if child already has data, populate it.
                        const result = new ManagedGroup<TObject, TKey, TGroupKey>(x);
                        const child = sourceGroups.lookup(x);
                        if (child !== undefined) {
                            //dodgy cast but fine as a groups is always a ManagedGroup;
                            const group = <ManagedGroup<TObject, TKey, TGroupKey>>child;
                            result.update(updater => updater.clone(group.getInitialUpdates()));
                        }

                        return result;
                    }),
                    disposeMany(),
                );
            //create parent groups
            const parentGroups = asObservableCache(parentGroups$);

            //connect to each individual item and update the resulting group
            const updateFromChilds = sourceGroups.connect()
                .pipe(
                    subscribeMany(x => {
                        return x.cache.connect().subscribe(updates => {
                            const groupToUpdate = parentGroups.lookup(x.key);
                            if (groupToUpdate !== undefined) {
                                groupToUpdate.update(updater => updater.clone(updates));
                            }
                        });
                    }),
                    disposeMany(),
                )
             .subscribe();

            const notifier = parentGroups.connect()
                .pipe(
                    map(x => {
                        const groups = ixFrom(x).pipe(
                            ixMap(s => new Change<Group<TObject, TKey, TGroupKey>, TGroupKey>(s.reason, s.key, s.current)),
                        );
                        return new GroupChangeSet<TObject, TKey, TGroupKey>(groups);
                    }),
                )
             .subscribe(observer);

            return Disposable.create(() => {
                notifier.unsubscribe();
                updateFromChilds.unsubscribe();
                sourceGroups.dispose();
                parentGroups.dispose();
                // updateFromChilds.unsubscribe();
            });
        });
    };
}