import { MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { tap } from 'rxjs/operators';
import { isMap } from '../../util/isMap';
import { isWeakSet } from '../../util/isWeakSet';
import { isSet } from '../../util/isSet';
import { isWeakMap } from '../../util/isWeakMap';
import { MonoTypeChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject, TKey>(target: Map<TKey, TObject>): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject, TKey extends object>(target: WeakMap<TKey, TObject>): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject, TKey>(target: Set<TObject>): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
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
 */
export function clone<TObject, TKey>(target: TObject[]): MonoTypeChangeSetOperatorFunction<TObject, TKey>;
export function clone<TObject, TKey>(collection: Map<TKey, TObject> | WeakMap<any, TObject> | Set<TObject> | WeakSet<any> | TObject[]): MonoTypeChangeSetOperatorFunction<TObject, TKey> {

    type collectionWrapper = { add(value: TObject, key: TKey): void; remove(value: TObject, key: TKey): void; };
    let cw: collectionWrapper;
    if (Array.isArray(collection)) {
        cw = {
            add(value: TObject, key: TKey): void {
                collection.push(value);
            },
            remove(value: TObject, key: TKey): void {
                collection.splice(collection.indexOf(value));
            },
        };
    } else if (isWeakMap(collection) || isMap(collection)) {
        cw = {
            add(value: TObject, key: TKey): void {
                collection.set(key, value);
            },
            remove(value: TObject, key: TKey): void {
                collection.delete(key);
            },
        };
    } else if (isWeakSet(collection) || isSet(collection)) {
        cw = {
            add(value: TObject, key: TKey): void {
                collection.add(value);
            },
            remove(value: TObject, key: TKey): void {
                collection.delete(value);
            },
        };
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