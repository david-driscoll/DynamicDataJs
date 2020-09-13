import { Subject } from 'rxjs';
import { IChangeSet } from '../../src/cache/IChangeSet';
import { Person } from '../domain/Person';
import { bind } from '../../src/cache/operators/bind';
import { ChangeSet } from '../../src/cache/ChangeSet';
import { Change } from '../../src/cache/Change';

describe('BindEqualityTests', () => {
    it('should not remove person when given the same person as two different references when using reference equality', () => {
        const subject = new Subject<IChangeSet<Person, string>>();
        const values: Person[] = [];
        subject.pipe(bind(values, bind.indexOfAdapter(values))).subscribe();

        const person = new Person('Adult1', 50);
        subject.next(new ChangeSet([new Change<Person, string>('add', person.name, person)]));

        expect(values.length).toBe(1);

        subject.next(new ChangeSet([new Change<Person, string>('remove', person.name, new Person('Adult1', 50))]));

        expect(values.length).toBe(1);
    });
    it('should not remove person when given the same person as two different references using deep equal equality', () => {
        const subject = new Subject<IChangeSet<Person, string>>();
        const values: Person[] = [];
        subject.pipe(bind(values, bind.deepEqualAdapter(values))).subscribe();

        const person = new Person('Adult1', 50);
        subject.next(new ChangeSet([new Change<Person, string>('add', person.name, person)]));

        expect(values.length).toBe(1);

        subject.next(new ChangeSet([new Change<Person, string>('remove', person.name, new Person('Adult1', 50))]));

        expect(values.length).toBe(0);
    });
});
