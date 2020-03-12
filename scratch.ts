/* eslint-disable unicorn/no-abusive-eslint-disable */
/* eslint-disable */
// import { reactive, effect, enableTracking } from '@vue/reactivity';

import { notifyPropertyChanged, notificationsFor, NotifyPropertyChanged } from './src/notify/notifyPropertyChangedSymbol';
import { filter, map } from 'rxjs/operators';
function whenAnyPropertyChanged<TObject>(value: NotifyPropertyChanged<TObject>, ...keys: (keyof TObject)[]) {
    return (keys.length > 0 ? notificationsFor(value).pipe(filter(property => keys.includes(property))) : notificationsFor(value)).pipe(
        map(z => value)
    );
}

const a = {
    first: 'david',
    last: 'driscoll',
};
var b = notifyPropertyChanged(a);
var n = notificationsFor(b);
b; //?
n.subscribe; //?
whenAnyPropertyChanged(b, 'first').subscribe(x => console.log(x));

b.last = 'notme';
b.first = 'test';
