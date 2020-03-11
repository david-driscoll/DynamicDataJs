import { notificationsFor, Npc } from '../../notify/notifyPropertyChanged';
import { filter, map } from 'rxjs/operators';
import { concat, defer, Observable, of } from 'rxjs';

export type PropertyValue<TObject, TProperty extends keyof TObject> = { sender: TObject; value: TObject[TProperty] };

export function whenChanged<TObject, TProperty extends keyof TObject>(
    value: Npc<TObject>,
    key: TProperty,
    notifyInitial = true,
    fallbackValue?: () => TObject[TProperty],
) {
    return whenChangedValues(value, key, notifyInitial, fallbackValue).pipe(
        filter(x => !!x.value),
        map(z => z.value),
    );
}

function whenChangedValues<TObject, TProperty extends keyof TObject>(
    value: Npc<TObject>,
    key: TProperty,
    notifyInitial = true,
    fallbackValue?: () => TObject[TProperty],
): Observable<PropertyValue<Npc<TObject>, TProperty>> {
    const propertyChanged = notificationsFor(value).pipe(
        filter(x => x === key),
        map(t => ({ sender: value, value: value[key] } as PropertyValue<Npc<TObject>, TProperty>)),
    );
    return notifyInitial
        ? concat(
            defer(() => of({
                sender: value,
                value: value[key] || fallbackValue?.(),
            } as PropertyValue<Npc<TObject>, TProperty>)),
            propertyChanged,
        )
        : propertyChanged;
}