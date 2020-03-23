import { notifyPropertyChangedSymbol } from '../notify/notifyPropertyChangedSymbol';
import { Observable, Subject } from 'rxjs';
import { EqualityComparer } from '../util/isEqualityComparer';
import { isWeakMap } from '../util/isWeakMap';

function defaultComparer<T>(a: T, b: T) {
    return a === b;
}

const NotifyPropertyChangedBaseSubject = Symbol.for('NotifyPropertyChangedBaseSubject');
const notifyPropertyChangedSymbolInternal = Symbol.for('notifyPropertyChangedSymbolInternal');

function setAndRaise<THIS extends { [notifyPropertyChangedSymbol]: Observable<keyof THIS> }, TProperty extends keyof THIS>(target: THIS, property: TProperty, setter: (value: THIS[TProperty]) => void, newValue: THIS[TProperty], equalityComparer: EqualityComparer<THIS[TProperty]> = defaultComparer) {
    if (defaultComparer(target[property], newValue)) {
        return;
    }

    if (target[notifyPropertyChangedSymbol] === undefined) throw new Error('object is not setup to notify on property changes');

    setter(newValue);
    if ((target as any)[NotifyPropertyChangedBaseSubject].observers.length > 0) {
        (target as any)[NotifyPropertyChangedBaseSubject].next(property);
    }
}

function creator(object: any) {
    const sub = new Subject<string>();
    (object as any)[NotifyPropertyChangedBaseSubject] = sub;
    (object as any)[notifyPropertyChangedSymbolInternal] = sub.asObservable();
}


export abstract class NotifyPropertyChangedBase {
    private readonly [NotifyPropertyChangedBaseSubject] = new Subject<keyof this>();
    [notifyPropertyChangedSymbol] = this[NotifyPropertyChangedBaseSubject].asObservable();
}
Object.defineProperty(NotifyPropertyChangedBase.prototype, 'setAndRaise', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function setAndRaiseProto<THIS extends NotifyPropertyChangedBase, TProperty extends keyof THIS>(this: THIS, property: TProperty, setter: (value: THIS[TProperty]) => void, newValue: THIS[TProperty], equalityComparer: EqualityComparer<THIS[TProperty]> = defaultComparer) {
        if (this[notifyPropertyChangedSymbol] === undefined) {
            creator(this);
        }
        return setAndRaise(this, property, setter, newValue, equalityComparer);
    },
});

export function NotifyPropertyChanged<TFunction extends { new(...args: any[]): {} }>(target: TFunction): TFunction {
    Object.defineProperty(target.prototype, NotifyPropertyChangedBaseSubject, {
        enumerable: false,
        configurable: false,
        writable: true,
        value: undefined,
    });

    Object.defineProperty(target.prototype, notifyPropertyChangedSymbolInternal, {
        writable: true,
        configurable: false,
        enumerable: false,
        value: undefined,
    });

    Object.defineProperty(target.prototype, notifyPropertyChangedSymbol, {
        enumerable: false,
        configurable: false,
        get() {
            if (this[notifyPropertyChangedSymbolInternal] === undefined) {
                creator(this);
            }
            return this[notifyPropertyChangedSymbolInternal];
        },
    });

    Object.defineProperty(target.prototype, 'setAndRaise', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function setAndRaiseProto<THIS extends InstanceType<TFunction> & { [notifyPropertyChangedSymbol]: Observable<keyof InstanceType<TFunction>> }, TProperty extends keyof THIS>(this: THIS, property: TProperty, setter: (value: THIS[TProperty]) => void, newValue: THIS[TProperty], equalityComparer: EqualityComparer<THIS[TProperty]> = defaultComparer) {
            if (this[notifyPropertyChangedSymbol] === undefined) {
                creator(this);
            }
            return setAndRaise(this, property, setter, newValue, equalityComparer);
        },
    });
    return target;
}

export function NotifyChanged<T>(equalityComparer: EqualityComparer<T> = defaultComparer) {
    return function NotifyChangedDecorator(target: Object, propertyKey: string | symbol) {
        const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
        if (descriptor) {
            if (descriptor.value) {
                Object.defineProperty(target, propertyKey, {
                    enumerable: descriptor.enumerable,
                    configurable: descriptor.configurable,
                    get() {
                        return this[propertyKey];
                    },
                    set(this: NotifyPropertyChangedBase, value): void {
                        setAndRaise(this, propertyKey as any, v => (this as any)[propertyKey] = v, value, equalityComparer);
                    },
                });
            } else {
                Object.defineProperty(target, propertyKey, {
                    enumerable: descriptor.enumerable,
                    configurable: descriptor.configurable,
                    get() {
                        return descriptor.get!.call(this);
                    },
                    set(this: NotifyPropertyChangedBase, value): void {
                        setAndRaise(this, propertyKey as any, v => descriptor.set!.call(this, v), value, equalityComparer);
                    },
                });
            }
        } else {
            const sym = Symbol('private_field_' + (typeof propertyKey === 'string' ? propertyKey : (propertyKey as any).description));
            const privateDescriptor: PropertyDescriptor = {
                writable: true,
                configurable: false,
                enumerable: false,
                value: undefined,
            };
            Object.defineProperty(target, sym, privateDescriptor);
            Object.defineProperty(target, propertyKey, {
                enumerable: true,
                configurable: true,
                get() {
                    return this[sym];
                },
                set(this: NotifyPropertyChangedBase, value): void {
                    setAndRaise(this, propertyKey as any, v => (this as any)[sym] = v, value, equalityComparer);
                },
            });
        }
    };
}
