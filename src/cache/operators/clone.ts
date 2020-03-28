import { MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { tap } from 'rxjs/operators';
import { isMap } from '../../util/isMap';
import { isWeakSet } from '../../util/isWeakSet';
import { isSet } from '../../util/isSet';
import { isWeakMap } from '../../util/isWeakMap';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';
import equal from 'fast-deep-equal';
import { bind } from './bind';
import { find, from } from 'ix/iterable';

/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 * @param deepEqual Use deep equality for finding values
 */
export function clone<TObject, TKey>(target: Map<TKey, TObject>, deepEqual?: boolean): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 * @param deepEqual Use deep equality for finding values
 */
export function clone<TObject, TKey>(target: Set<TObject>, deepEqual?: boolean): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject extends object, TKey>(target: WeakSet<TObject>): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 * @param deepEqual Use deep equality for finding values
 */
export function clone<TObject, TKey>(target: TObject[], deepEqual?: boolean): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
export function clone<TObject, TKey>(collection: Map<TKey, TObject> | Set<TObject> | WeakSet<any> | TObject[], deepEqual?: boolean): MonoTypeChangeSetOperatorFunction<TObject, TKey> {

    type collectionWrapper = { add(value: TObject, key: TKey): void; remove(value: TObject, key: TKey): void; };
    let cw: collectionWrapper;
    if (Array.isArray(collection)) {
        cw = deepEqual ?
            arrayFindIndexAdapter(collection) :
            arrayIndexOfAdapter(collection);
    } else if (isMap(collection)) {
        cw = deepEqual ?
            mapFindAdapter(collection) :
            mapDeleteAdapter(collection);
    } else if (isWeakSet(collection) || isSet(collection)) {
        if (isWeakSet(collection)) {
            cw = setDeleteAdapter(collection as any);
        } else {
            cw = deepEqual ? setFindAdapter(collection) : setDeleteAdapter(collection);
        }
    } else {
        throw new Error('Unsupported collection type');
    }

    return function cloneOperator(source) {
        return source.pipe(
            tap(changes => {
                for (const change of changes) {
                    switch (change.reason) {
                        case 'add':
                            cw.add(change.current, change.key);
                            break;
                        case 'remove':
                            cw.remove(change.current, change.key);
                            break;
                        case 'update':
                            cw.remove(change.previous!, change.key);
                            cw.add(change.current, change.key);
                            break;
                    }
                }
            }),
        );
    };
}

function arrayIndexOfAdapter<TObject, TKey>(collection: TObject[]) {
    return {
        add(value: TObject, key: TKey): void {
            collection.push(value);
        },
        remove(value: TObject, key: TKey): void {
            const index = collection.indexOf(value);
            if (index > -1) {
                collection.splice(index, 1);
            }
        },
    };
}

function arrayFindIndexAdapter<TObject, TKey>(collection: TObject[]) {
    return {
        add(value: TObject, key: TKey): void {
            collection.push(value);
        },
        remove(value: TObject, key: TKey): void {
            const index = collection.findIndex(v => equal(v, value));
            if (index > -1) {
                collection.splice(index, 1);
            }
        },
    };
}

function setDeleteAdapter<TObject, TKey>(collection: Set<TObject>) {
    return {
        add(value: TObject, key: TKey): void {
            collection.add(value);
        },
        remove(value: TObject, key: TKey): void {
            collection.delete(value);
        },
    };
}

function setFindAdapter<TObject, TKey>(collection: Set<TObject>) {
    return {
        add(value: TObject, key: TKey): void {
            collection.add(value);
        },
        remove(value: TObject, key: TKey): void {
            const found = find(collection, v => equal(v, value));
            if (found !== undefined) {
                collection.delete(found);
            }
        },
    };
}

function mapDeleteAdapter<TObject, TKey>(collection: Map<TKey, TObject>) {
    return {
        add(value: TObject, key: TKey): void {
            collection.set(key, value);
        },
        remove(value: TObject, key: TKey): void {
            collection.delete(key);
        },
    };
}

function mapFindAdapter<TObject, TKey>(collection: Map<TKey, TObject>) {
    return {
        add(value: TObject, key: TKey): void {
            const foundKey = find(collection, ([k]) => equal(k, key));
            if (foundKey !== undefined) {
                collection.set(foundKey[0], value);
            } else {
                collection.set(key, value);
            }
        },
        remove(value: TObject, key: TKey): void {
            const foundKey = find(collection, ([k]) => equal(k, key));
            if (foundKey !== undefined) {
                collection.delete(foundKey[0]);
            } else {
                collection.delete(key);
            }
        },
    };
}
