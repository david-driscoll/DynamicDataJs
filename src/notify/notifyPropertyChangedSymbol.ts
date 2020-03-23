import { isObject, hasOwn, hasChanged, isSymbol, isArray } from '../util/is';
import { Observer, Subject, Observable } from 'rxjs';

type IterableCollections = Map<any, any> | Set<any>;
type WeakCollections = WeakMap<any, any> | WeakSet<any>;
type CollectionTypes = IterableCollections | WeakCollections;
type PrimitiveTypes = string | number | symbol | any[];
export const notifyPropertyChangedSymbol = Symbol.for('NotifyPropertyChanged');
export const notifyCollectionChangedSymbol = Symbol.for('NotifyCollectionChanged');

export type ObjectType<T> = T extends CollectionTypes ? never : T extends PrimitiveTypes ? never : T extends any[] ? never : T;
export type NotifyPropertyChangedType<T = any> = T extends { [notifyPropertyChangedSymbol]: Observable<string> } ? T : T extends ObjectType<T> ? T & { [notifyPropertyChangedSymbol]: Observable<string> } : never;

export type CollectionType<T> = T extends CollectionTypes ? never : T extends any[] ? never : T;
export type NotifyCollectionChangedType<T = any> = T extends { [notifyCollectionChangedSymbol]: Observable<string> } ? T : T extends CollectionType<T> ? T & { [notifyCollectionChangedSymbol]: Observable<unknown> } : never;

export const objectToString = Object.prototype.toString;
export const toTypeString = (value: unknown): string => objectToString.call(value);

export const toRawType = (value: unknown): string => {
    return toTypeString(value).slice(8, -1);
};

const rawToNpc = new WeakMap<any, NotifyPropertyChangedType<any>>();
const npcToRaw = new WeakMap<NotifyPropertyChangedType<any>, any>();
const npcObservers = new WeakMap<any, Subject<any>>();
const collectionTypes = new Set<Function>([Set, Map, WeakMap, WeakSet]);
const isObservableType = (() => {
    const types = 'Object,Array,Map,Set,WeakMap,WeakSet';
    const map: Record<string, boolean> = Object.create(null);
    const list: Array<string> = types.split(',');
    for (const element of list) {
        map[element.toLowerCase()] = true;
    }

    return (value: string) => map[value.toLowerCase()];
})();

export function toRaw<T>(observed: T): T {
    return npcToRaw.get(observed) ?? observed;
}

export function isNotifyPropertyChanged<T>(target: T): target is NotifyPropertyChangedType<T> {
    if (target && (target as any)[notifyPropertyChangedSymbol] !== undefined) {
        return true;
    }

    const data = npcToRaw.get(target);
    return data && data[notifyPropertyChangedSymbol] !== undefined;
}

export function isNotifyCollectionChanged<T>(target: T): target is NotifyCollectionChangedType<T> {
    if (target && (target as any)[notifyCollectionChangedSymbol] !== undefined) {
        return true;
    }

    const data = npcToRaw.get(target);
    return data && data[notifyCollectionChangedSymbol] !== undefined;
}

const canObserve = (value: any): boolean => {
    return !value._isInpc && isObservableType(toRawType(value));
    // && !nonReactiveValues.has(value);
};

export function observePropertyChanges<T>(target: ObjectType<T>): NotifyPropertyChangedType<T> {
    return createNotifyPropertyChanged(target, rawToNpc, npcToRaw, npcObservers, objectHandlers, collectionHandlers) as any;
}
export function observeCollectionChanges<T>(target: CollectionType<T>): NotifyCollectionChangedType<T> {
    return createNotifyPropertyChanged(target, rawToNpc, npcToRaw, npcObservers, objectHandlers, collectionHandlers) as any;
}

export function notificationsFor<T>(target: NotifyPropertyChangedType<T>): Observable<keyof T>;
export function notificationsFor<T>(target: NotifyCollectionChangedType<T>): Observable<unknown>;
export function notificationsFor<T>(target: NotifyPropertyChangedType<T> | NotifyCollectionChangedType<T>): Observable<any> {
    if (isNotifyPropertyChanged(target)) {
        return target[notifyPropertyChangedSymbol];
    }
    if (isNotifyCollectionChanged(target)) {
        return target[notifyCollectionChangedSymbol];
    }
    throw new Error('target is not notifiable');
}

function objectHandlers(observer: Observer<string | symbol>) {
    function set(target: object, key: string | symbol, value: unknown, receiver: object): boolean {
        const oldValue = (target as any)[key];
        const hadKey = hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver);
        // don't trigger if target is something up in the prototype chain of original
        if (target === toRaw(receiver)) {
            if (!hadKey) {
                observer.next(key);
            } else if (hasChanged(value, oldValue)) {
                observer.next(key);
            }
        }
        return result;
    }

    function deleteProperty(target: object, key: string | symbol): boolean {
        const hadKey = hasOwn(target, key);
        const result = Reflect.deleteProperty(target, key);
        if (result && hadKey) {
            observer.next(key);
        }
        return result;
    }

    const handlers: ProxyHandler<object> = {
        set,
        deleteProperty,
    };
    return handlers;
}

const collectionHandlers = (() => {
    type MapTypes = Map<any, any> | WeakMap<any, any>;
    type SetTypes = Set<any> | WeakSet<any>;

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const toReactive = <T extends unknown>(value: any): any => (isObject(value) ? observePropertyChanges(value) : value);

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const getProto = <T extends CollectionTypes>(v: T): any => Reflect.getPrototypeOf(v);

    function get(target: MapTypes, key: unknown, wrap: typeof toReactive) {
        target = toRaw(target);
        const rawKey = toRaw(key);
        const { has, get } = getProto(target);
        if (has.call(target, key)) {
            return wrap(get.call(target, key));
        } else if (has.call(target, rawKey)) {
            return wrap(get.call(target, rawKey));
        }
    }

    function forEach(this: IterableCollections, callback: Function, thisArgument: unknown) {
        const observed = this;
        const target = toRaw(observed);
        const wrap = toReactive;
        // important: create sure the callback is
        // 1. invoked with the reactive map as `this` and 3rd arg
        // 2. the value received should be a corresponding reactive/readonly.
        function wrappedCallback(value: unknown, key: unknown) {
            return callback.call(observed, wrap(value), wrap(key), observed);
        }

        return getProto(target).forEach.call(target, wrappedCallback, thisArgument);
    }

    // eslint-disable-next-line unicorn/consistent-function-scoping
    function createInstrumentationGetter(instrumentation: Record<string, Function>) {
        return (target: CollectionTypes, key: string | symbol, receiver: CollectionTypes) =>
            Reflect.get(hasOwn(instrumentation, key) && key in target ? instrumentation : target, key, receiver);
    }

    return function collectionHandlers(observer: Observer<unknown>) {
        function add(this: SetTypes, value: unknown) {
            value = toRaw(value);
            const target = toRaw(this);
            const proto = getProto(target);
            const hadKey = proto.has.call(target, value);
            const result = proto.add.call(target, value);
            if (!hadKey) {
                observer.next(undefined!);
            }
            return result;
        }

        function set(this: MapTypes, key: unknown, value: unknown) {
            value = toRaw(value);
            key = toRaw(key);
            const target = toRaw(this);
            const proto = getProto(target);
            const hadKey = proto.has.call(target, key);
            const oldValue = proto.get.call(target, key);
            const result = proto.set.call(target, key, value);
            if (!hadKey) {
                observer.next(undefined!);
            } else if (hasChanged(value, oldValue)) {
                observer.next(undefined!);
            }
            return result;
        }

        function deleteEntry(this: CollectionTypes, key: unknown) {
            const target = toRaw(this);
            const { has, get, delete: del } = getProto(target);
            let hadKey = has.call(target, key);
            if (!hadKey) {
                key = toRaw(key);
                hadKey = has.call(target, key);
            }
            // forward the operation before queueing reactions
            const result = del.call(target, key);
            if (hadKey) {
                observer.next(undefined!);
            }
            return result;
        }

        function clear(this: IterableCollections) {
            const target = toRaw(this);
            const hadItems = target.size !== 0;
            // forward the operation before queueing reactions
            const result = getProto(target).clear.call(target);
            if (hadItems) {
                observer.next(undefined!);
            }
            return result;
        }

        function createIterableMethod(method: string | symbol, isReadonly: boolean) {
            return function(this: IterableCollections, ...arguments_: unknown[]) {
                const target = toRaw(this);
                const isPair = method === 'entries' || (method === Symbol.iterator && target instanceof Map);
                const innerIterator = getProto(target)[method].apply(target, arguments_);
                const wrap = toReactive;
                // return a wrapped iterator which returns observed versions of the
                // values emitted from the real iterator
                return {
                    // iterator protocol
                    next() {
                        const { value, done } = innerIterator.next();
                        return done
                            ? { value, done }
                            : {
                                value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                                done,
                            };
                    },
                    // iterable protocol
                    [Symbol.iterator]() {
                        return this;
                    },
                };
            };
        }

        const instrumentations: Record<string, Function> = {
            get(this: MapTypes, key: unknown) {
                return get(this, key, toReactive);
            },
            add,
            set,
            delete: deleteEntry,
            clear,
            forEach,
        };

        const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
        iteratorMethods.forEach(method => {
            instrumentations[method as string] = createIterableMethod(method, false);
        });

        const collectionHandlers: ProxyHandler<CollectionTypes> = {
            get: createInstrumentationGetter(instrumentations),
        };
        return collectionHandlers;
    };
})();

function createNotifyPropertyChanged<TObject extends new (...args: any) => any>(
    target: InstanceType<TObject>,
    toProxy: WeakMap<any, NotifyPropertyChangedType<any>>,
    toRaw: WeakMap<NotifyPropertyChangedType<any>, any>,
    toObserver: WeakMap<any, Subject<any>>,
    objectHandlers: (observer: Observer<string | symbol>) => ProxyHandler<any>,
    collectionHandlers: (observer: Observer<unknown>) => ProxyHandler<any>,
): NotifyPropertyChangedType<TObject> {
    if (!isObject(target)) {
        return target as any;
    }
    // target already has corresponding Proxy
    let observed = toProxy.get(target);
    if (observed !== void 0) {
        return observed;
    }
    // target is already a Proxy
    if (toRaw.has(target)) {
        return target as any;
    }
    // only a whitelist of value types can be observed.
    if (!canObserve(target)) {
        return target as any;
    }

    let observer = new Subject<any>();
    if (collectionTypes.has(target.constructor)) {
        observed = new Proxy(target, collectionHandlers(observer));
    } else {
        observed = new Proxy(target, objectHandlers(observer));
    }

    toObserver.set(target, observer);
    toObserver.set(observed, observer);
    toProxy.set(target, observed);
    toRaw.set(observed, target);
    Object.defineProperty(observed, notifyPropertyChangedSymbol, {
        get() {
            return observer.asObservable();
        },
        enumerable: false,
        configurable: false,
    });
    return observed;
}
