import { isNotifyPropertyChanged, NotifyPropertyChangedType } from '../../notify/notifyPropertyChangedSymbol';
import { Observable, OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { mergeMany } from './mergeMany';
import { whenChanged } from './whenChanged';

/**
 * Observes property changes for the specified property, starting with the current value
 * @category Operator
 * @param value The source
 * @param key The key to observe
 * @param notifyInitial If true the resulting observable includes the initial value
 * @param fallbackValue A fallback value may be specified to ensure a notification is received when a value is unobtainable.
 *           For example when observing Parent.Child.Age, if Child == null the value is unobtainable as Age is a struct and cannot be set to Null.
 *           For an object like Parent.Child.Sibling, sibling is an object so if Child == null, the value null and obtainable and is returned as null.
 */
export function whenValueChanged<TObject, TProperty extends keyof TObject>(
    value: TObject,
    key: TProperty,
    notifyInitial?: boolean,
    fallbackValue?: () => TObject[TProperty],
): Observable<TObject[TProperty]>;
/**
 * Watches each item in the collection and notifies when any of them has changed
 * @category Operator
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TValue The type of the value.
 * @param key The key to watch
 * @param notifyInitial if set to <c>true</c> [notify on initial value].
 */
export function whenValueChanged<TObject, TKey, TProperty extends keyof TObject>(
    key: TProperty,
    notifyInitial?: boolean,
): OperatorFunction<IChangeSet<TObject, TKey>, TObject[TProperty]>;
export function whenValueChanged<TObject, TProperty extends keyof TObject>(
    value: NotifyPropertyChangedType<TObject> | TProperty,
    key: TProperty | boolean,
    notifyInitial?: boolean,
    fallbackValue?: () => TObject[TProperty],
) {
    if (typeof value !== 'string' && typeof value !== 'symbol') {
        if (!isNotifyPropertyChanged(value)) {
            throw new Error(
                'Object must implement the notifyPropertyChangedSymbol or inherit from the NotifyPropertyChangedBase class or be wrapped by the proxy method observePropertyChanges',
            );
        }
        return whenChanged(value as any, key as TProperty, notifyInitial, fallbackValue);
    } else {
        return function whenValueChangedOperator(source: Observable<IChangeSet<TObject, TProperty>>) {
            return source.pipe(mergeMany(v => whenChanged(v, value as TProperty, key as boolean | undefined)));
        };
    }
}
