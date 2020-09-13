import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { IChangeSet } from '../../src/cache/IChangeSet';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { and } from '../../src/cache/operators/and';
import { first } from 'ix/iterable';
import {} from 'ix/iterable/operators';
import { Person } from '../domain/Person';

describe('AndFixture', () => {
    let _source1: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _source2: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;
    beforeEach(() => {
        _source1 = updateable(new SourceCache<Person, string>(p => p.name));
        _source2 = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(and([_source1.connect(), _source2.connect()]));
    });
    afterEach(() => {
        _source1.dispose();
        _source2.dispose();
        _results.dispose();
    });

    it('Updating one source only produces no results', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);

        expect(_results.messages.length).toBe(0);
        expect(_results.data.size).toBe(0);
    });

    it('Updating one source only produces no results', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);

        expect(_results.messages.length).toBe(0);
        expect(_results.data.size).toBe(0);
    });

    it('Updating both produces results', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);
        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
        expect(first(_results.data.values())).toBe(person);
    });

    it('Removing from one removes from result', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);

        _source2.remove(person);
        expect(_results.messages.length).toBe(2);
        expect(_results.data.size).toBe(0);
    });

    it('Updating one produces only one update', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);

        const personUpdated = new Person('Adult1', 51);
        _source2.addOrUpdate(personUpdated);
        expect(_results.messages.length).toBe(2);
        expect(_results.data.size).toBe(1);
        expect(first(_results.data.values())).toBe(personUpdated);
    });

    it('Starting with non empty source produces no result', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);

        const result = asAggregator(and([_source1.connect(), _source2.connect()]));

        expect(_results.messages.length).toBe(0);
        expect(result.data.size).toBe(0);

        result.dispose();
    });
});
