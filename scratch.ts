/* eslint-disable unicorn/no-abusive-eslint-disable */
/* eslint-disable */
// import { reactive, effect, enableTracking } from '@vue/reactivity';

import { npc, notificationsFor, Npc } from './src/notify/notifyPropertyChanged';
import { filter, map } from 'rxjs/operators';
function whenAnyPropertyChanged<TObject>(value: Npc<TObject>, ...keys: (keyof TObject)[]) {
    return (keys.length > 0 ? notificationsFor(value).pipe(filter(property => keys.includes(property))) : notificationsFor(value)).pipe(
        map(z => value)
    );
}

const a = {
    first: 'david',
    last: 'driscoll',
};
var b = npc(a);
var n = notificationsFor(b);
b; //?
n.subscribe; //?
whenAnyPropertyChanged(b, 'first').subscribe(x => console.log(x));

b.last = 'notme';
b.first = 'test';
