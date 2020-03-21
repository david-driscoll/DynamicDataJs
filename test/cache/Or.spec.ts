import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { IChangeSet } from '../../src/cache/IChangeSet';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { or } from '../../src/cache/operators/or';
import { first } from 'ix/iterable'
import { Person } from '../domain/Person';

describe('OrFixture', () => {
    let _source1: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _source2: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;
    beforeEach(() => {
        _source1 = updateable(new SourceCache<Person, string>(p => p.name));
        _source2 = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(or([_source1.connect(), _source2.connect()]));
    });
    afterEach(() => {
        _source1.dispose();
        _source2.dispose();
        _results.dispose();
    });

    it('UpdatingOneSourceOnlyProducesResult', () => {
        const person= new Person('Adult1', 50);
        _source1.addOrUpdate(person);

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
    });

    it('UpdatingBothProducesResultsAndDoesNotDuplicateTheMessage', () => {
        const person= new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);
        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
        expect( first(_results.data.values())).toBe(person);
    });

    it('RemovingFromOneDoesNotFromResult', () => {
        const person= new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);

        _source2.remove(person);
        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
    });

    it('UpdatingOneProducesOnlyOneUpdate', () => {
        const person= new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);

        const personUpdated= new Person('Adult1', 51);
        _source2.addOrUpdate(personUpdated);
        expect(_results.messages.length).toBe(2);
        expect(_results.data.size).toBe(1);
        expect( first(_results.data.values())).toBe(personUpdated);
    });
});
