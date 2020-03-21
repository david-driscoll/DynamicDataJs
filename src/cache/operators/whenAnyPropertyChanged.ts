import {
    isNotifyPropertyChanged,
    notificationsFor,
    NotifyPropertyChangedType,
} from '../../notify/notifyPropertyChangedSymbol';
import { filter, map } from 'rxjs/operators';
import { MonoTypeOperatorFunction, Observable } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { mergeMany } from './mergeMany';

/**
 * Notifies when any any property on the object has changed
 * @typeparam TObject The type of the object
 * @param value The object to observe
 * @param propertiesToMonitor specify properties to Monitor, or omit to monitor all property changes
 */
export function whenAnyPropertyChanged<TObject>(value: NotifyPropertyChangedType<TObject>, ...propertiesToMonitor: (keyof TObject)[]): Observable<NotifyPropertyChangedType<TObject>>;
/**
 * Watches each item in the collection and notifies when any of them has changed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param propertiesToMonitor specify properties to Monitor, or omit to monitor all property changes
 */
export function whenAnyPropertyChanged<TObject, TProperty extends keyof TObject>(...propertiesToMonitor: (keyof TObject)[]): MonoTypeOperatorFunction<IChangeSet<NotifyPropertyChangedType<TObject>, TProperty>>;
export function whenAnyPropertyChanged<TObject, TProperty extends keyof TObject>(...value: (NotifyPropertyChangedType<TObject> | keyof TObject)[]) {
    if (value.length > 0 && isNotifyPropertyChanged(value[0])) {
        const propertiesToMonitor = value.slice(1) as (keyof TObject)[];
        return (propertiesToMonitor.length > 0 ?
            notificationsFor(value[0] as any)
                .pipe(filter(property => propertiesToMonitor.includes(property as any))) :
            notificationsFor(value[0] as any)).pipe(map(z => value),
        );
    }
    return function whenAnyPropertyChangedOperator(source: Observable<IChangeSet<NotifyPropertyChangedType<TObject>, TProperty>>) {
        const propertiesToMonitor = value as (keyof TObject)[];
        return source.pipe(mergeMany(value => whenAnyPropertyChanged(value, ...propertiesToMonitor)));
    };
}