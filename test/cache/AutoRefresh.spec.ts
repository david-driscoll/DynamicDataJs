import {} from 'rxjs';
import { tap } from 'rxjs/operators';
import { first, last, range, toArray as ixToArray } from 'ix/iterable';
import { map as ixMap } from 'ix/iterable/operators';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { autoRefresh } from '../../src/cache/operators/autoRefresh';
import { asAggregator } from '../util/aggregator';
import { notifyPropertyChanged, NotifyPropertyChanged } from '../../src/notify/notifyPropertyChangedSymbol';
import { autoRefreshOnObservable } from '../../src/cache/operators/autoRefreshOnObservable';
import { whenAnyPropertyChanged } from '../../src/cache/operators/whenAnyPropertyChanged';
import { transform } from '../../src/cache/operators/transform';
import { bind } from '../../src/cache/operators/bind';

describe('AutoRefreshFixture', () => {
    it('AutoRefresh', () => {
        const items = ixToArray(range(1, 100)
            .pipe(ixMap(i => notifyPropertyChanged(new Person('Person' + i, 1)))),
        );

        //result should only be true when all items are set to true
        const cache = updateable(new SourceCache<NotifyPropertyChanged<Person>, string>(m => m.name));
        const results = asAggregator(
            cache.connect()
                .pipe(autoRefresh('age')),
        );

        cache.addOrUpdateValues(items);

        expect(results.data.size).toBe(100);
        expect(results.messages.length).toBe(1);

        items[0].age = 10;
        expect(results.data.size).toBe(100);
        expect(results.messages.length).toBe(2);

        expect(first(results.messages[1])!.reason).toBe('refresh');

        //remove an item and check no change is fired
        const toRemove = items[1];
        cache.remove(toRemove);
        expect(results.data.size).toBe(99);
        expect(results.messages.length).toBe(3);
        toRemove.age = 100;
        expect(results.messages.length).toBe(3);

        //add it back in and check it updates
        cache.addOrUpdate(toRemove);
        expect(results.messages.length).toBe(4);
        toRemove.age = 101;
        expect(results.messages.length).toBe(5);

        expect(first(last(results.messages)!)!.reason).toBe('refresh');

        cache.dispose();
        results.dispose();
    });
    it('AutoRefreshFromObservable', () => {
        const items = ixToArray(range(1, 100)
            .pipe(ixMap(i => notifyPropertyChanged(new Person('Person' + i, 1)))),
        );

        //result should only be true when all items are set to true
        const cache = updateable(new SourceCache<NotifyPropertyChanged<Person>, string>(m => m.name));
        const results = asAggregator(
            cache.connect()
                .pipe(
                    autoRefreshOnObservable(z => whenAnyPropertyChanged(z)),
                ),
        );

        cache.addOrUpdateValues(items);

        expect(results.data.size).toBe(100);
        expect(results.messages.length).toBe(1);

        items[0].age = 10;
        expect(results.data.size).toBe(100);
        expect(results.messages.length).toBe(2);

        expect(first(results.messages[1])!.reason).toBe('refresh');

        //remove an item and check no change is fired
        const toRemove = items[1];
        cache.remove(toRemove);
        expect(results.data.size).toBe(99);
        expect(results.messages.length).toBe(3);
        toRemove.age = 100;
        expect(results.messages.length).toBe(3);

        //add it back in and check it updates
        cache.addOrUpdate(toRemove);
        expect(results.messages.length).toBe(4);
        toRemove.age = 101;
        expect(results.messages.length).toBe(5);

        expect(first(last(results.messages)!)!.reason).toBe('refresh');

        cache.dispose();
        results.dispose();
    });

    it('MakeSelectMagicWorkWithObservable', () => {
        const initialItem = notifyPropertyChanged(new IntHolder(1, 'Initial Description'));
        const cache = updateable(new SourceCache<NotifyPropertyChanged<IntHolder>, string>(m => m.description));
        cache.addOrUpdate(initialItem);

        const values: string [] = [];
        const descriptionStream = cache.connect()
            .pipe(
                autoRefresh('description'),
                transform(z => z.description, true),
                bind(values),
            );

        descriptionStream.subscribe();//dispose

        const newDescription = 'New Description';
        initialItem.description = newDescription;

        expect(newDescription).toBe('New Description');
    });

});

class Person {
    constructor(public  name: string, public age: number) {
    }
}

class IntHolder {
    constructor(public value: number, public  description: string) {
    }
}