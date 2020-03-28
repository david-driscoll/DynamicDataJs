import { Person } from '../domain/Person';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { IDisposable } from '../../src/util';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { clone } from '../../src/cache/operators/clone';
import { Subscription } from 'rxjs';
import { first, toArray, count, find } from 'ix/iterable';
import { randomPersonGenerator } from '../domain/RandomPersonGenerator';

describe('CloneFixture', () => {
    describe('Array', () => {
        let _collection: Person[];
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _cloner: Subscription;

        beforeEach(() => {
            _collection = [];
            _source = updateable(new SourceCache<Person, string>(p => p.name));
            _cloner = _source.connect()
                .pipe(clone(_collection))
                .subscribe();
        });

        afterEach(() => {
            _cloner.unsubscribe();
            _source.dispose();
        });

        it('AddToSourceAddsToDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);

            expect(_collection.length).toBe(1);
            expect(_collection[0]).toBe(person);
        });

        it('UpdateToSourceUpdatesTheDestination', () => {
            const person = new Person('Adult1', 50);
            const personUpdated = new Person('Adult1', 51);
            _source.addOrUpdate(person);
            _source.addOrUpdate(personUpdated);

            expect(_collection.length).toBe(1);
            expect(_collection[0]).toBe(personUpdated);
        });

        it('RemoveSourceRemovesFromTheDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);
            _source.remove(person);

            expect(_collection.length).toBe(0);
        });

        it('BatchAdd', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);

            expect(_collection.length).toBe(100);
            expect(_collection).toEqual(_collection);
        });

        it('BatchRemove', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);
            _source.clear();

            expect(_collection.length).toBe(0);
        });
    });

    describe('Array deepEqual', () => {
        let _collection: Person[];
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _cloner: Subscription;

        beforeEach(() => {
            _collection = [];
            _source = updateable(new SourceCache<Person, string>(p => p.name));
            _cloner = _source.connect()
                .pipe(clone(_collection, true))
                .subscribe();
        });

        afterEach(() => {
            _cloner.unsubscribe();
            _source.dispose();
        });

        it('AddToSourceAddsToDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);

            expect(_collection.length).toBe(1);
            expect(_collection[0]).toBe(person);
        });

        it('UpdateToSourceUpdatesTheDestination', () => {
            const person = new Person('Adult1', 50);
            const personUpdated = new Person('Adult1', 51);
            _source.addOrUpdate(person);
            _source.addOrUpdate(personUpdated);

            expect(_collection.length).toBe(1);
            expect(_collection[0]).toBe(personUpdated);
        });

        it('RemoveSourceRemovesFromTheDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);
            _source.remove(person);

            expect(_collection.length).toBe(0);
        });

        it('BatchAdd', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);

            expect(_collection.length).toBe(100);
            expect(_collection).toEqual(_collection);
        });

        it('BatchRemove', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);
            _source.clear();

            expect(_collection.length).toBe(0);
        });
    });

    describe('Map', () => {
        let _collection: Map<string, Person>;
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _cloner: Subscription;

        beforeEach(() => {
            _collection = new Map();
            _source = updateable(new SourceCache<Person, string>(p => p.name));
            _cloner = _source.connect()
                .pipe(clone(_collection))
                .subscribe();
        });

        afterEach(() => {
            _cloner.unsubscribe();
            _source.dispose();
        });

        it('AddToSourceAddsToDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);

            expect(_collection.size).toBe(1);
            expect(_collection.get(person.key)).toBe(person);
        });

        it('UpdateToSourceUpdatesTheDestination', () => {
            const person = new Person('Adult1', 50);
            const personUpdated = new Person('Adult1', 51);
            _source.addOrUpdate(person);
            _source.addOrUpdate(personUpdated);

            expect(_collection.size).toBe(1);
            expect(_collection.get(person.key)).toBe(personUpdated);
        });

        it('RemoveSourceRemovesFromTheDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);
            _source.remove(person);

            expect(_collection.size).toBe(0);
        });

        it('BatchAdd', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);

            expect(_collection.size).toBe(100);
            expect(_collection).toEqual(_collection);
        });

        it('BatchRemove', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);
            _source.clear();

            expect(_collection.size).toBe(0);
        });
    });

    describe('Map deepEqual primitive', () => {
        let _collection: Map<string, Person>;
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _cloner: Subscription;

        beforeEach(() => {
            _collection = new Map();
            _source = updateable(new SourceCache<Person, string>(p => p.name, true));
            _cloner = _source.connect()
                .pipe(clone(_collection, true))
                .subscribe();
        });

        afterEach(() => {
            _cloner.unsubscribe();
            _source.dispose();
        });

        it('AddToSourceAddsToDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);

            expect(_collection.size).toBe(1);
            expect(_collection.get(person.key)).toBe(person);
        });

        it('UpdateToSourceUpdatesTheDestination', () => {
            const person = new Person('Adult1', 50);
            const personUpdated = new Person('Adult1', 51);
            _source.addOrUpdate(person);
            _source.addOrUpdate(personUpdated);

            expect(_collection.size).toBe(1);
            expect(_collection.get(person.key)).toBe(personUpdated);
        });

        it('RemoveSourceRemovesFromTheDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);
            _source.remove(person);

            expect(_collection.size).toBe(0);
        });

        it('BatchAdd', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);

            expect(_collection.size).toBe(100);
            expect(_collection).toEqual(_collection);
        });

        it('BatchRemove', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);
            _source.clear();

            expect(_collection.size).toBe(0);
        });
    });

    describe('Map deepEqual object', () => {
        let _collection: Map<{ name: string }, Person>;
        let _source: ISourceCache<Person, { name: string }> & ISourceUpdater<Person, { name: string }>;
        let _cloner: Subscription;

        beforeEach(() => {
            _collection = new Map();
            _source = updateable(new SourceCache<Person, { name: string }>(p => ({ name: p.name }), true));
            _cloner = _source.connect()
                .pipe(clone(_collection, true))
                .subscribe();
        });

        afterEach(() => {
            _cloner.unsubscribe();
            _source.dispose();
        });

        it('AddToSourceAddsToDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);

            expect(_collection.size).toBe(1);
            const key = find(_source.keys(), z => z.name === person.name)!;
            expect(_collection.get(key)).toBe(person);
        });

        it('UpdateToSourceUpdatesTheDestination', () => {
            const person = new Person('Adult1', 50);
            const personUpdated = new Person('Adult1', 51);
            _source.addOrUpdate(person);
            _source.addOrUpdate(personUpdated);

            expect(_collection.size).toBe(1);
            const key = find(_source.keys(), z => z.name === person.name)!;
            expect(_collection.get(key)).toBe(personUpdated);
        });


        it('RemoveSourceRemovesFromTheDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);
            _source.remove(person);

            expect(_collection.size).toBe(0);
        });

        it('BatchAdd', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);

            expect(_collection.size).toBe(100);
            expect(_collection).toEqual(_collection);
        });

        it('BatchRemove', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);
            _source.clear();

            expect(_collection.size).toBe(0);
        });
    });

    describe('Set', () => {
        let _collection: Set<Person>;
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _cloner: Subscription;

        beforeEach(() => {
            _collection = new Set();
            _source = updateable(new SourceCache<Person, string>(p => p.name));
            _cloner = _source.connect()
                .pipe(clone(_collection))
                .subscribe();
        });

        afterEach(() => {
            _cloner.unsubscribe();
            _source.dispose();
        });

        it('AddToSourceAddsToDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);

            expect(_collection.size).toBe(1);
            expect(first(_collection)).toBe(person);
        });

        it('UpdateToSourceUpdatesTheDestination', () => {
            const person = new Person('Adult1', 50);
            const personUpdated = new Person('Adult1', 51);
            _source.addOrUpdate(person);
            _source.addOrUpdate(personUpdated);

            expect(_collection.size).toBe(1);
            expect(first(_collection)).toBe(personUpdated);
        });

        it('RemoveSourceRemovesFromTheDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);
            _source.remove(person);

            expect(_collection.size).toBe(0);
        });

        it('BatchAdd', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);

            expect(_collection.size).toBe(100);
            expect(_collection).toEqual(_collection);
        });

        it('BatchRemove', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);
            _source.clear();

            expect(_collection.size).toBe(0);
        });
    })

    describe('Set deepEqual', () => {
        let _collection: Set<Person>;
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _cloner: Subscription;

        beforeEach(() => {
            _collection = new Set();
            _source = updateable(new SourceCache<Person, string>(p => p.name));
            _cloner = _source.connect()
                .pipe(clone(_collection, true))
                .subscribe();
        });

        afterEach(() => {
            _cloner.unsubscribe();
            _source.dispose();
        });

        it('AddToSourceAddsToDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);

            expect(_collection.size).toBe(1);
            expect(first(_collection)).toBe(person);
        });

        it('UpdateToSourceUpdatesTheDestination', () => {
            const person = new Person('Adult1', 50);
            const personUpdated = new Person('Adult1', 51);
            _source.addOrUpdate(person);
            _source.addOrUpdate(personUpdated);

            expect(_collection.size).toBe(1);
            expect(first(_collection)).toBe(personUpdated);
        });

        it('RemoveSourceRemovesFromTheDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);
            _source.remove(person);

            expect(_collection.size).toBe(0);
        });

        it('BatchAdd', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);

            expect(_collection.size).toBe(100);
            expect(_collection).toEqual(_collection);
        });

        it('BatchRemove', () => {
            const people = toArray(randomPersonGenerator(100));
            _source.addOrUpdateValues(people);
            _source.clear();

            expect(_collection.size).toBe(0);
        });
    })

    describe('WeakSet', () => {
        let _collection: WeakSet<Person>;
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _cloner: Subscription;

        beforeEach(() => {
            _collection = new Set();
            _source = updateable(new SourceCache<Person, string>(p => p.name));
            _cloner = _source.connect()
                .pipe(clone(_collection))
                .subscribe();
        });

        afterEach(() => {
            _cloner.unsubscribe();
            _source.dispose();
        });

        it('AddToSourceAddsToDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);

            expect(_collection.has(person)).toBe(true);
        });

        it('UpdateToSourceUpdatesTheDestination', () => {
            const person = new Person('Adult1', 50);
            const personUpdated = new Person('Adult1', 51);
            _source.addOrUpdate(person);
            _source.addOrUpdate(personUpdated);

            expect(_collection.has(person)).toBe(false);
            expect(_collection.has(personUpdated)).toBe(true);
        });

        it('RemoveSourceRemovesFromTheDestination', () => {
            const person = new Person('Adult1', 50);
            _source.addOrUpdate(person);
            _source.remove(person);

            expect(_collection.has(person)).toBe(false);
        });
    })
});
