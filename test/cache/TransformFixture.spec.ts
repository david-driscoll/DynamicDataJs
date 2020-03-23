import { Person } from '../domain/Person';
import { Observable, Subject } from 'rxjs';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ChangeSetAggregator } from '../util/aggregator';
import { PersonWithGender } from '../domain/PersonWithGender';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { transform } from '../../src/cache/operators/transform';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { range, elementAt, first, last, toArray, from } from 'ix/iterable';
import { map, orderBy } from 'ix/iterable/operators';
import { transformForced } from '../../src/cache/operators/transformForced';

describe('TransformFixture', () => {
    let source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let results: ChangeSetAggregator<PersonWithGender, string>;
    const transformFactory = (p: Person) => PersonWithGender.create(p, p.age % 2 == 0 ? 'M' : 'F');

    function retransform() {
        results = new ChangeSetAggregator<PersonWithGender, string>(source.connect()
            .pipe(transform(transformFactory)),
        );
    }

    function retransformNext(retransformer: Observable<unknown>) {
        results = new ChangeSetAggregator<PersonWithGender, string>(source.connect()
            .pipe(transformForced(transformFactory, retransformer)),
        );
    }

    function retransformDelegate(retransformer: Observable<(person: Person) => boolean>) {
        results = new ChangeSetAggregator<PersonWithGender, string>(source.connect()
            .pipe(transformForced(transformFactory, retransformer)),
        );
    }

    beforeEach(() => {
        source = updateable(new SourceCache<Person, string>(p => p.name));
    });

    afterEach(() => {
        source.dispose();
        results?.dispose();
    });

    it('ReTransformAll', () => {
        const people = range(1, 10)
            .pipe(map(i => new Person('Name' + i, i)));
        const forceTransform = new Subject<unknown>();

        retransformNext(forceTransform);
        source.addOrUpdateValues(people);
        forceTransform.next(undefined);

        expect(results.messages.length).toBe(2);
        expect(results.messages[1].updates).toBe(10);

        for (let i = 1; i <= 10; i++) {
            const original = elementAt(results.messages[0], i - 1)!.current;
            const updated = elementAt(results.messages[1], i - 1)!.current;

            expect(updated).toEqual(original);
            expect(original).toEqual(updated);
        }
    });

    it('ReTransformSelected', () => {
        const people = range(1, 10)
            .pipe(map(i => new Person('Name' + i, i)));
        const forceTransform = new Subject<(person: Person) => boolean>();

        retransformDelegate(forceTransform);

        source.addOrUpdateValues(people);
        forceTransform.next(person => person.age <= 5);

        expect(results.messages.length).toBe(2);
        expect(results.messages[1].updates).toBe(5);

        for (let i = 1; i <= 5; i++) {
            const original = elementAt(results.messages[0], i - 1)!.current;
            const updated = elementAt(results.messages[1], i - 1)!.current;
            expect(updated).toEqual(original);
            expect(original).not.toBe(updated);
            // dispose const stub = new TransformStub(forceTransform)
        }
    });

    it('Add', () => {
        retransform();

        const person = new Person('Adult1', 50);
        source.addOrUpdate(person);

        expect(results.messages.length).toBe(1);
        expect(results.data.size).toBe(1);
        expect(first(results.data.values())).toEqual(transformFactory(person));
        // dispose const stub = new TransformStub()
    });

    it('Remove', () => {
        const key = 'Adult1';
        const person = new Person(key, 50);

        retransform();

        source.addOrUpdate(person);
        source.removeKey(key);

        expect(results.messages.length).toBe(2);
        expect(results.messages.length).toBe(2);
        expect(results.messages[0].adds).toBe(1);
        expect(results.messages[1].removes).toBe(1);
        expect(results.data.size).toBe(0);
        // dispose const stub = new TransformStub()
    });

    it('Update', () => {
        const key = 'Adult1';
        const newperson = new Person(key, 50);
        const updated = new Person(key, 51);

        retransform();

        source.addOrUpdate(newperson);
        source.addOrUpdate(updated);

        expect(results.messages.length).toBe(2);
        expect(results.messages[0].adds).toBe(1);
        expect(results.messages[1].updates).toBe(1);
        // dispose const stub = new TransformStub()
    });

    it('BatchOfUniqueUpdates', () => {
        const people = range(1, 100)
            .pipe(map(i => new Person('Name' + i, i)));

        retransform();

        source.addOrUpdateValues(people);

        expect(results.messages.length).toBe(1);
        expect(results.messages[0].adds).toBe(100);

        const transformed = toArray(people
            .pipe(
                map(transformFactory),
                orderBy(z => z.age),
            ));
        expect(toArray(from(results.data.values())
            .pipe(
                orderBy(z => z.age),
            ))).toMatchObject(transformed);
    });

    it('SameKeyChanges', () => {

        retransform();

        const people = range(1, 10)
            .pipe(map(i => new Person('Name', i)));

        source.addOrUpdateValues(people);

        expect(results.messages.length).toBe(1);
        expect(results.messages[0].adds).toBe(1);
        expect(results.messages[0].updates).toBe(9);
        expect(results.data.size).toBe(1);

        const lastTransformed = transformFactory(last(people)!);
        const onlyItemInCache = first(results.data.values());

        expect(onlyItemInCache).toEqual(lastTransformed);
        // dispose const stub = new TransformStub()
    });

    it('Clear', () => {

        retransform();

        const people = range(1, 100)
            .pipe(map(i => new Person('Name' + i, i)));

        source.addOrUpdateValues(people);
        source.clear();

        expect(results.messages.length).toBe(2);
        expect(results.messages[0].adds).toBe(100);
        expect(results.messages[1].removes).toBe(100);
        expect(results.data.size).toBe(0);
        // dispose const stub = new TransformStub()
    });

    it('TransformToNull', () => {
        const results = new ChangeSetAggregator<PersonWithGender, string>
        (
            source.connect()
                .pipe(transform(p => null as any)),
        );

        source.addOrUpdate(new Person('Adult1', 50));

        expect(results.messages.length).toBe(1);
        expect(results.data.size).toBe(1);
        expect(first(results.data.values())).toBe(null);
    });
});
