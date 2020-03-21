import { notifyPropertyChangedSymbol } from '../notify/notifyPropertyChangedSymbol';
import { Observable, Subject } from 'rxjs';
import { EqualityComparer } from '../util/isEqualityComparer';

function defaultComparer<T>(a: T, b: T) {
    return a === b;
}
const NotifyPropertyChangedBaseSubject = Symbol.for('NotifyPropertyChangedBaseSubject');

function setAndRaise<THIS extends { [notifyPropertyChangedSymbol]: Observable<keyof THIS> }, TProperty extends keyof THIS>(target: THIS, property: TProperty, setter: (value: THIS[TProperty]) => void, newValue:THIS[TProperty], equalityComparer: EqualityComparer<THIS[TProperty]> = defaultComparer) {
    if (defaultComparer(target[property], newValue)) {
        return;
    }

    setter(newValue);
    (target as any)[NotifyPropertyChangedBaseSubject].next(property);
}

export function NotifyPropertyChanged<TFunction extends {new(...args:any[]):{}}>(target: TFunction) {
    return class extends target {
        private readonly [NotifyPropertyChangedBaseSubject] = new Subject<keyof this>();
        [notifyPropertyChangedSymbol] = this[NotifyPropertyChangedBaseSubject].asObservable();

        protected setAndRaise<TProperty extends keyof this>(property: TProperty, setter: (value: this[TProperty]) => void, newValue:this[TProperty], equalityComparer: EqualityComparer<this[TProperty]> = defaultComparer) {
            setAndRaise(this, property, setter , newValue , equalityComparer );
        }
    }
}

export function NotifyChanged<T>(equalityComparer: EqualityComparer<T> = defaultComparer) {
    return function NotifyChangedDecorator(target: Object, propertyKey: string | symbol) {
        const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)!;
        if (descriptor.value) {
            Object.defineProperty(target, propertyKey, {
                enumerable: descriptor.enumerable,
                configurable: descriptor.configurable,
                get() {
                    return this[propertyKey];
                },
                set(this: NotifyPropertyChangedBase, value): void {
                    this.setAndRaise(propertyKey as any, v => (this as any)[propertyKey] = v, value, equalityComparer);
                }
            });
        } else {
            Object.defineProperty(target, propertyKey, {
                enumerable: descriptor.enumerable,
                configurable: descriptor.configurable,
                get() {
                    return descriptor.get!.call(this);
                },
                set(this: NotifyPropertyChangedBase, value): void {
                    this.setAndRaise(propertyKey as any, v => descriptor.set!.call(this, v), value, equalityComparer);
                }
            });
        }
    }
}

export abstract class NotifyPropertyChangedBase {
    private readonly [NotifyPropertyChangedBaseSubject] = new Subject<keyof this>();
    [notifyPropertyChangedSymbol] = this[NotifyPropertyChangedBaseSubject].asObservable();

    protected setAndRaise<TProperty extends keyof this>(property: TProperty, setter: (value: this[TProperty]) => void, newValue:this[TProperty], equalityComparer: EqualityComparer<this[TProperty]> = defaultComparer) {
        setAndRaise(this, property, setter, newValue, equalityComparer);
    }
}
