import { isNotifyPropertyChanged, notificationsFor, NotifyPropertyChanged } from '../../notify/notifyPropertyChangedSymbol';
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
export function whenAnyPropertyChanged<TObject>(value: NotifyPropertyChanged<TObject>, ...propertiesToMonitor: (keyof TObject)[]): Observable<NotifyPropertyChanged<TObject>>;
/**
 * Watches each item in the collection and notifies when any of them has changed
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @param propertiesToMonitor specify properties to Monitor, or omit to monitor all property changes
 */
export function whenAnyPropertyChanged<TObject, TProperty extends keyof TObject>(...propertiesToMonitor: (keyof TObject)[]): MonoTypeOperatorFunction<IChangeSet<NotifyPropertyChanged<TObject>, TProperty>>;
export function whenAnyPropertyChanged<TObject, TProperty extends keyof TObject>(...value: (NotifyPropertyChanged<TObject> | keyof TObject)[]) {
    if (value.length > 0 && isNotifyPropertyChanged(value[0])) {
        const propertiesToMonitor = value.slice(1) as (keyof TObject)[];
        return (propertiesToMonitor.length > 0 ? notificationsFor(value[0] as NotifyPropertyChanged<TObject>).pipe(filter(property => propertiesToMonitor.includes(property))) : notificationsFor(value[0] as NotifyPropertyChanged<TObject>)).pipe(
            map(z => value),
        );
    }
    return function whenAnyPropertyChangedOperator(source: Observable<IChangeSet<NotifyPropertyChanged<TObject>, TProperty>>) {
        const propertiesToMonitor = value as (keyof TObject)[];
        return source.pipe(mergeMany(value => whenAnyPropertyChanged(value, ...propertiesToMonitor)));
    };
}