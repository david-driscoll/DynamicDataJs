import { Person } from '../domain/Person';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { onItemAdded } from '../../src/cache/operators/onItemAdded';
import { onItemUpdated } from '../../src/cache/operators/onItemUpdated';
import { onItemRemoved } from '../../src/cache/operators/onItemRemoved';

describe('OnItemFixture', function () {
    it('OnItemAddCalled', () => {
        let called = false;
        const source = updateable(new SourceCache<Person, number>(x => x.age));

        source
            .connect()
            .pipe(onItemAdded(_ => (called = true)))
            .subscribe();

        const person = new Person('A', 1);

        source.addOrUpdate(person);
        expect(called).toBe(true);
    });

    it('OnItemRemovedCalled', () => {
        let called = false;
        const source = updateable(new SourceCache<Person, number>(x => x.age));

        source
            .connect()
            .pipe(onItemRemoved(_ => (called = true)))
            .subscribe();

        const person = new Person('A', 1);
        source.addOrUpdate(person);
        source.remove(person);
        expect(called).toBe(true);
    });

    it('OnItemUpdatedCalled', () => {
        let called = false;
        const source = updateable(new SourceCache<Person, number>(x => x.age));

        source
            .connect()
            .pipe(onItemUpdated((x, y) => (called = true)))
            .subscribe();

        const person = new Person('A', 1);
        source.addOrUpdate(person);
        const update = new Person('B', 1);
        source.addOrUpdate(update);
        expect(called).toBe(true);
    });
});
