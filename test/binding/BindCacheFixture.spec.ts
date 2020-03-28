import { Person } from '../domain/Person';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { Subject, Subscription } from 'rxjs';
import { SortComparer } from '../../src/cache/operators/sort';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { bind } from '../../src/cache/operators/bind';
import { first, toArray } from 'ix/iterable';
import { randomPersonGenerator } from '../domain/RandomPersonGenerator';

describe('BindingListCacheFixture', () => {

    let _collection: Person[];
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _binder: Subscription;
    let _comparer = SortComparer.ascending<Person>('name');

    beforeEach(() => {
        _collection = [];
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _binder = _source.connect().pipe(bind(_collection)).subscribe();
    });

    afterEach(() => {
        _binder.unsubscribe();
        _source.dispose();
    });

    it('AddToSourceAddsToDestination', () => {
        let person = new Person('Adult1', 50);
        _source.addOrUpdate(person);

        expect(_collection.length).toBe(1);
        expect(first(_collection)).toBe(person);
    });

    it('UpdateToSourceUpdatesTheDestination', () => {
        let person = new Person('Adult1', 50);
        let personUpdated = new Person('Adult1', 51);
        _source.addOrUpdate(person);
        _source.addOrUpdate(personUpdated);

        expect(_collection.length).toBe(1);
        expect(first(_collection)).toEqual(personUpdated);
    });

    it('RemoveSourceRemovesFromTheDestination', () => {
        let person = new Person('Adult1', 50);
        _source.addOrUpdate(person);
        _source.remove(person);

        expect(_collection.length).toBe(0);
    });

    it('BatchAdd', () => {
        let people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);

        expect(_collection.length).toBe(100);
        expect(_collection).toEqual(_collection);
    });

    it('BatchRemove', () => {
        let people = toArray(randomPersonGenerator(100));
        _source.addOrUpdateValues(people);
        _source.clear();
        expect(_collection.length).toBe(0);
    });
});
