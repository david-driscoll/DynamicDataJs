import { BehaviorSubject, combineLatest, Observable, of, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { asObservableCache } from './asObservableCache';
import { transform } from './transform';
import { groupOn } from './groupOn';
import { from as ixFrom, toArray, toArray as ixToArray } from 'ix/iterable';
import { map, tap } from 'rxjs/operators';
import { groupBy as ixGroupBy } from 'ix/iterable/operators';
import { disposeMany } from './disposeMany';
import { filterDynamic } from './filter';
import { Node } from '../Node';
import { ChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Transforms the object to a fully recursive tree, create a hiearchy based on the pivot function
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param pivotOn The pivot on.
 * @param predicateChanged Observable to change the underlying predicate.
 */
export function transformToTree<TObject, TKey>(
    pivotOn: (value: TObject) => TKey,
    predicateChanged?: Observable<(node: Node<TObject, TKey>) => boolean>,
): ChangeSetOperatorFunction<TObject, TKey, Node<TObject, TKey>, TKey> {
    return function transformToTreeOperator(source) {
        return new Observable<IChangeSet<Node<TObject, TKey>, TKey>>(observer => {
            const refilterObservable = new BehaviorSubject<any>(null);

            const allData = asObservableCache(source);

            //for each object we need a node which provides
            //a structure to set the parent and children
            const allNodes = asObservableCache(
                allData.connect()
                    .pipe(
                        transform((t, v) => new Node(t, v)),
                    ),
            );

            const groupedByPivot = asObservableCache(
                allNodes.connect()
                    .pipe(groupOn(x => pivotOn(x.item))),
            );

            function updateChildren(parentNode: Node<TObject, TKey>) {
                const lookup = groupedByPivot.lookup(parentNode.key);
                if (lookup !== undefined) {
                    const children = toArray(lookup!.cache.values());
                    parentNode.update(u => u.addOrUpdateValues(children));
                    children.forEach(x => x.setParent(parentNode));
                }
            }

            //as nodes change, maintain parent and children
            const parentSetter = allNodes.connect()
                .pipe(tap(changes => {
                        ixFrom(changes)
                            .pipe(ixGroupBy(c => pivotOn(c.current.item)))
                            .forEach(group => {
                                    const parentKey = group.key;
                                    const parent = allNodes.lookup(parentKey);

                                    if (parent === undefined) {
                                        //deal with items which have no parent
                                        for (const change of group) {
                                            if (change.reason !== 'refresh') {
                                                change.current.setParent(undefined);
                                            }

                                            switch (change.reason) {
                                                case 'add':
                                                    updateChildren(change.current);
                                                    break;
                                                case 'update': {
                                                    //copy children to the new node amd set parent
                                                    const children = toArray(change.previous!.children.values());
                                                    change.current.update(updater => updater.addOrUpdateValues(children));
                                                    children.forEach(child => child.setParent(change.current));

                                                    //remove from old parent if different
                                                    const previous = change.previous!;
                                                    const previousParent = pivotOn(previous.item);

                                                    if (previousParent !== previous.key) {
                                                        const n = allNodes.lookup(previousParent);
                                                        if (n !== undefined) {
                                                            n.update(u => u.removeKey(change.key));
                                                        }
                                                    }

                                                    break;
                                                }

                                                case 'remove': {
                                                    //remove children and null out parent
                                                    const children = toArray(change.current.children.values());
                                                    change.current.update(updater => updater.removeValues(children));
                                                    children.forEach(child => child.setParent(undefined));

                                                    break;
                                                }

                                                case 'refresh': {
                                                    const previousParent = change.current.parent;
                                                    if (previousParent !== parent) {
                                                        if (previousParent !== undefined) {
                                                            previousParent.update(u => u.removeKey(change.key));
                                                        }
                                                        change.current.setParent(undefined);
                                                    }

                                                    break;
                                                }
                                            }
                                        }
                                    } else {
                                        //deal with items have a parent
                                        parent.update(updater => {
                                            const p = parent;

                                            for (let change of group) {
                                                const previous = change.previous;
                                                const node = change.current;
                                                const key = node.key;

                                                switch (change.reason) {
                                                    case 'add': {
                                                        // update the parent node
                                                        node.setParent(p);
                                                        updater.addOrUpdate(node);
                                                        updateChildren(node);

                                                        break;
                                                    }

                                                    case 'update': {
                                                        //copy children to the new node amd set parent
                                                        const children = toArray(previous!.children.values());
                                                        change.current.update(u => u.addOrUpdateValues(children));
                                                        children.forEach(child => child.setParent(change.current));

                                                        //check whether the item has a new parent
                                                        const previousItem = previous!.item;
                                                        const previousKey = previous!.key;
                                                        const previousParent = pivotOn(previousItem);

                                                        if (previousParent !== previousKey) {
                                                            const n = allNodes.lookup(previousParent);
                                                            if (n !== undefined) {
                                                                n.update(u => u.removeKey(key));
                                                            }
                                                        }

                                                        //finally update the parent
                                                        node.setParent(p);
                                                        updater.addOrUpdate(node);

                                                        break;
                                                    }

                                                    case 'remove': {
                                                        node.setParent(undefined);
                                                        updater.removeKey(key);

                                                        const children = toArray(node.children.values());
                                                        change.current.update(u => u.removeValues(children));
                                                        children.forEach(child => child.setParent(undefined));

                                                        break;
                                                    }

                                                    case 'refresh': {
                                                        const previousParent = change.current.parent;
                                                        if (previousParent !== parent) {
                                                            if (previousParent !== undefined)
                                                                previousParent.update(u => u.removeKey(change.key));
                                                            change.current.setParent(p);
                                                            updater.addOrUpdate(change.current);
                                                        }

                                                        break;
                                                    }
                                                }
                                            }
                                        });
                                    }
                                },
                                disposeMany(),
                            );
                        refilterObservable.next(null);
                    }),
                    disposeMany(),
                )
                .subscribe();

            const filters = combineLatest([predicateChanged ?? of<(node: Node<TObject, TKey>) => boolean>(node => node.isRoot), refilterObservable.asObservable()])
                .pipe(
                    map(([predicate, _]) => predicate),
                );
            const result = allNodes.connect()
                .pipe(
                    filterDynamic(filters),
                )
                .subscribe(observer);

            return () => {
                result.unsubscribe();
                parentSetter.unsubscribe();
                allData.dispose();
                allNodes.dispose();
                groupedByPivot.dispose();
                refilterObservable.complete();
            };
        });
    };
}