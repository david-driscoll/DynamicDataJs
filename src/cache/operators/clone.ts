import { MonoTypeOperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { tap } from 'rxjs/operators';

/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject, TKey>(target: Map<TKey, TObject>): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject, TKey extends object>(target: WeakMap<TKey, TObject>): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject, TKey>(target: Set<TObject>): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject extends object, TKey>(target: WeakSet<TObject>): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>;
/**
 * Clones the changes  into the specified collection
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param target The target.
 */
export function clone<TObject, TKey>(target: TObject[]): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>>
export function clone<TObject, TKey>(collection: Map<TKey, TObject> | WeakMap<any, TObject> | Set<TObject> | WeakSet<any> | TObject[]): MonoTypeOperatorFunction<IChangeSet<TObject, TKey>> {

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
    } else if (collection[Symbol.toStringTag] === 'WeakMap') {
        const map: WeakMap<any, TObject> = collection as any;
        cw = {
            add(value: TObject, key: TKey): void {
                map.set(key, value);
            },
            remove(value: TObject, key: TKey): void {
                map.delete(key);
            },
        };
    } else if (collection[Symbol.toStringTag] === 'Map') {
        const map: Map<TKey, TObject> = collection as any;
        cw = {
            add(value: TObject, key: TKey): void {
                map.set(key, value);
            },
            remove(value: TObject, key: TKey): void {
                map.delete(key);
            },
        };
    } else if (collection[Symbol.toStringTag] === 'WeakSet') {
        const set: WeakSet<any> = collection as any;
        cw = {
            add(value: TObject, key: TKey): void {
                set.add(value);
            },
            remove(value: TObject, key: TKey): void {
                set.delete(value);
            },
        };

    } else if (collection[Symbol.toStringTag] === 'Set') {
        const set: Set<any> = collection as any;
        cw = {
            add(value: TObject, key: TKey): void {
                set.add(value);
            },
            remove(value: TObject, key: TKey): void {
                set.delete(value);
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