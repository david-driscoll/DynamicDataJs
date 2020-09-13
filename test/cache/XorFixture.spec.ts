import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { or } from '../../src/cache/operators/or';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { xor } from '../../src/cache/operators/xor';
import { Person } from '../domain/Person';

describe('XOrFixture', () => {
    let _source1: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _source2: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;

    beforeEach(() => {
        _source1 = updateable(new SourceCache<Person, string>(p => p.name));
        _source2 = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(xor([_source1.connect(), _source2.connect()]));
    });

    afterEach(() => {
        _source1.dispose();
        _source2.dispose();
        _results.dispose();
    });

    it('UpdatingOneSourceOnlyProducesResult', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
    });
    it('UpdatingBothDoeNotProducesResult', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);
        expect(_results.data.size).toBe(0);
    });
    it('RemovingFromOneDoesNotFromResult', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);

        _source2.remove(person);
        expect(_results.messages.length).toBe(3);
        expect(_results.data.size).toBe(1);
    });
    it('UpdatingOneProducesOnlyOneUpdate', () => {
        const person = new Person('Adult1', 50);
        _source1.addOrUpdate(person);
        _source2.addOrUpdate(person);

        const personUpdated = new Person('Adult1', 51);
        _source2.addOrUpdate(personUpdated);
        expect(_results.messages.length).toBe(2);
        expect(_results.data.size).toBe(0);
    });
});
