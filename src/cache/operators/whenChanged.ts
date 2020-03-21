import {
    isNotifyPropertyChanged,
    notificationsFor,
    NotifyPropertyChangedType,
} from '../../notify/notifyPropertyChangedSymbol';
import { filter, map } from 'rxjs/operators';
import { concat, defer, Observable, of } from 'rxjs';

export type PropertyValue<TObject, TProperty extends keyof TObject> = { sender: TObject; value: TObject[TProperty] };

export function whenChanged<TObject, TProperty extends keyof TObject>(
    value: TObject,
    key: TProperty,
    notifyInitial = true,
    fallbackValue?: () => TObject[TProperty],
) {
    if (!isNotifyPropertyChanged(value)) {
        throw new Error("Object must implement the notifyPropertyChangedSymbol or inherit from the NotifyPropertyChangedBase class or be wrapped by the proxy method observePropertyChanges");
    }
    return whenChangedValues(value, key, notifyInitial, fallbackValue).pipe(
        filter(x => !!x.value),
        map(z => z.value),
    );
}

function whenChangedValues<TObject, TProperty extends keyof TObject>(
    value: TObject,
    key: TProperty,
    notifyInitial = true,
    fallbackValue?: () => TObject[TProperty],
): Observable<PropertyValue<NotifyPropertyChangedType<TObject>, TProperty>> {
    if (!isNotifyPropertyChanged(value)) {
        throw new Error("Object must implement the notifyPropertyChangedSymbol or inherit from the NotifyPropertyChangedBase class or be wrapped by the proxy method observePropertyChanges");
    }
    const propertyChanged = notificationsFor(value).pipe(
        filter(x => x === key),
        map(t => ({ sender: value, value: value[key] } as PropertyValue<NotifyPropertyChangedType<TObject>, TProperty>)),
    );
    return notifyInitial
        ? concat(
            defer(() => of({
                sender: value,
                value: value[key] || fallbackValue?.(),
            } as PropertyValue<NotifyPropertyChangedType<TObject>, TProperty>)),
            propertyChanged,
        )
        : propertyChanged;
}