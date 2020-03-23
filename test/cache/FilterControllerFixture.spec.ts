import { ISourceCache } from '../../src/cache/ISourceCache';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import * as Assert from 'assert';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { IChangeSet } from '../../src/cache/IChangeSet';
import { ChangeSetAggregator } from '../util/aggregator';
import { Person } from '../domain/Person';
import { filterDynamic } from '../../src/cache/operators/filter';
import { every, first, from, range, toArray } from 'ix/iterable';
import { filter, map, orderBy } from 'ix/iterable/operators';
import { asObservableCache } from '../../src/cache/operators/asObservableCache';
import { tap } from 'rxjs/operators';

describe('FilterControllerFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;
    let _filter: Subject<(value: Person) => boolean>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>((p => p.key)));
        _filter = new BehaviorSubject<(value: Person) => boolean>(p => p.age > 20);
        _results = new ChangeSetAggregator<Person, string>(_source.connect()
            .pipe(filterDynamic(_filter))
        );
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('ChangeFilter', () => {
        const people = toArray(range(1, 100).pipe(map(i => new Person('P' + i, i))));

        _source.addOrUpdateValues(people);
        expect(_results.data.size).toBe(80);

        _filter.next(p => p.age <= 50);
        expect(_results.data.size).toBe(50);
        expect(_results.messages.length).toBe(2);
        expect(_results.messages[1].removes).toBe(50);
        expect(_results.messages[1].adds).toBe(20);

        expect(every(_results.data.values(), p => p.age <= 50)).toBe(true);
    });

    it('ReapplyFilterDoesntThrow', () => {
        const source = updateable(new SourceCache<Person, string>((p => p.key)));

        source.addOrUpdateValues(toArray(range(1, 100).pipe(map(i => new Person('P' + i, i)))));

        expect(() => asObservableCache(
            source.connect()
                .pipe(filterDynamic(of(undefined))),
        )).not.toThrow();
        source.dispose();
    });

    it('RepeatedApply', () => {
        const source = updateable(new SourceCache<Person, string>((p => p.key)));

        source.addOrUpdateValues(toArray(range(1, 100).pipe(map(i => new Person('P' + i, i)))));
        _filter.next(p => true);

        let latestChanges: IChangeSet<Person, string> = null!;
        const disposer = asObservableCache(
            source.connect()
                .pipe(
                    filterDynamic(_filter),
                    tap({
                        next(changes) {
                            latestChanges = changes;
                        },
                    }),
                ));

        _filter.next(p => false);
        expect(latestChanges.removes).toBe(100);
        expect(latestChanges.adds).toBe(0);

        _filter.next(p => true);
        expect(latestChanges.adds).toBe(100);
        expect(latestChanges.removes).toBe(0);

        _filter.next(p => false);
        expect(latestChanges.removes).toBe(100);
        expect(latestChanges.adds).toBe(0);

        _filter.next(p => true);
        expect(latestChanges.adds).toBe(100);
        expect(latestChanges.removes).toBe(0);

        _filter.next(p => false);
        expect(latestChanges.removes).toBe(100);
        expect(latestChanges.adds).toBe(0);

        disposer.dispose();
        source.dispose();
    });

    it('ReevaluateFilter', () => {
        //re-evaluate for inline changes
        const people = toArray(range(1, 100).pipe(map(i => new Person('P' + i, i))));

        _source.addOrUpdateValues(people);
        expect(_results.data.size).toBe(80);

        for (const person of people) {
            person.age = person.age + 10;
        }
        _filter.next(p => p.age > 20);

        expect(_results.data.size).toBe(90);
        expect(_results.messages.length).toBe(2);
        expect(_results.messages[1].adds).toBe(10);

        for (const person of people) {
            person.age = person.age - 10;
        }

        _filter.next(p => p.age > 20);

        expect(_results.data.size).toBe(80);
        expect(_results.messages.length).toBe(3);
        expect(_results.messages[2].removes).toBe(10);
    });

    it('AddMatched', () => {
        const person = new Person('Adult1', 50);
        _source.addOrUpdate(person);

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
        expect(first(_results.data.values())).toBe(person);
    });

    it('AddNotMatched', () => {
        const person = new Person('Adult1', 10);
        _source.addOrUpdate(person);

        expect(_results.messages.length).toBe(0);
        expect(_results.data.size).toBe(0);
    });

    it('AddNotMatchedAndUpdateMatched', () => {
        const key = 'Adult1';
        const notmatched = new Person(key, 19);
        const matched = new Person(key, 21);

        _source.edit(innerCache => {
            innerCache.addOrUpdate(notmatched);
            innerCache.addOrUpdate(matched);
        });

        expect(_results.messages.length).toBe(1);
        expect(first(_results.messages[0])!.current).toBe(matched);
        expect(first(_results.data.values())).toBe(matched);
    });

    it('AttemptedRemovalOfANonExistentKeyWillBeIgnored', () => {
        const key = 'Adult1';
        _source.removeKey(key);
        expect(_results.messages.length).toBe(0);
    });

    it('BatchOfUniqueUpdates', () => {
        const people = toArray(range(1, 100).pipe(map(i => new Person('Name' + i, i))));

        _source.addOrUpdateValues(people);
        expect(_results.messages.length).toBe(1);
        expect(_results.messages[0].adds).toBe(80);

        const filtered = toArray(from(people).pipe(filter(p => p.age > 20), orderBy(p => p.age)));
        expect(toArray(from(_results.data.values()).pipe(orderBy(p => p.age)))).toMatchObject(filtered);
    });

    it('BatchRemoves', () => {
        const people = toArray(range(1, 100).pipe(map(i => new Person('Name' + i, i))));

        _source.addOrUpdateValues(people);
        _source.removeValues(people);

        expect(_results.messages.length).toBe(2);
        expect(_results.messages[0].adds).toBe(80);
        expect(_results.messages[1].removes).toBe(80);
        expect(_results.data.size).toBe(0);
    });

    it('BatchSuccessiveUpdates', () => {
        const people = toArray(range(1, 100).pipe(map(i => new Person('Name' + i, i))));
        for (const person of people) {
            const person1 = person;
            _source.addOrUpdate(person1);
        }

        expect(_results.messages.length).toBe(80);
        expect(_results.data.size).toBe(80);
        const filtered = toArray(from(people).pipe(filter(p => p.age > 20), orderBy(p => p.age)));
        expect(toArray(from(_results.data.values()).pipe(orderBy(p => p.age)))).toMatchObject(filtered);
    });

    it('Clear', () => {
        const people = toArray(range(1, 100).pipe(map(i => new Person('Name' + i, i))));
        _source.addOrUpdateValues(people);
        _source.clear();

        expect(_results.messages.length).toBe(2);
        expect(_results.messages[0].adds).toBe(80);
        expect(_results.messages[1].removes).toBe(80);
        expect(_results.data.size).toBe(0);
    });

    it('Remove', () => {
        const key = 'Adult1';
        const person = new Person(key, 50);

        _source.addOrUpdate(person);
        _source.removeKey(key);

        expect(_results.messages.length).toBe(2);
        expect(_results.messages.length).toBe(2);
        expect(_results.messages[0].adds).toBe(1);
        expect(_results.messages[1].removes).toBe(1);
        expect(_results.data.size).toBe(0);
    });

    it('UpdateMatched', () => {
        const key = 'Adult1';
        const newperson = new Person(key, 50);
        const updated = new Person(key, 51);

        _source.addOrUpdate(newperson);
        _source.addOrUpdate(updated);

        expect(_results.messages.length).toBe(2);
        expect(_results.messages[0].adds).toBe(1);
        expect(_results.messages[1].updates).toBe(1);
    });

    it('SameKeyChanges', () => {
        const key = 'Adult1';

        _source.edit(updater => {
            updater.addOrUpdate(new Person(key, 50));
            updater.addOrUpdate(new Person(key, 52));
            updater.addOrUpdate(new Person(key, 53));
            updater.removeKey(key);
        });

        expect(_results.messages.length).toBe(1);
        expect(_results.messages[0].adds).toBe(1);
        expect(_results.messages[0].updates).toBe(2);
        expect(_results.messages[0].removes).toBe(1);
    });

    it('UpdateNotMatched', () => {
        const key = 'Adult1';
        const newperson = new Person(key, 10);
        const updated = new Person(key, 11);

        _source.addOrUpdate(newperson);
        _source.addOrUpdate(updated);

        expect(_results.messages.length).toBe(0);
        expect(_results.data.size).toBe(0);
    });
});