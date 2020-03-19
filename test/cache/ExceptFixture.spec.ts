import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { except } from '../../src/cache/operators/except';

describe('ExceptFixture', () => {
    let _targetSource: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _exceptSource: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;


    beforeEach(() => {
        _targetSource = updateable(new SourceCache<Person, string>(p => p.name));
        _exceptSource = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(except(_targetSource.connect(), _exceptSource.connect()));
    });

    afterEach(() => {
        _targetSource.dispose();
        _exceptSource.dispose();
        _results.dispose();
    });

    it('UpdatingOneSourceOnlyProducesResult', () => {
        const person = new Person('Adult1', 50);
        _targetSource.addOrUpdate(person);

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
    });
    it('DoNotIncludeExceptListItems', () => {
        const person = new Person('Adult1', 50);
        _exceptSource.addOrUpdate(person);
        _targetSource.addOrUpdate(person);

        expect(_results.messages.length).toBe(0);
        expect(_results.data.size).toBe(0);
    });
    it('RemovedAnItemFromExceptThenIncludesTheItem', () => {
        const person = new Person('Adult1', 50);
        _exceptSource.addOrUpdate(person);
        _targetSource.addOrUpdate(person);

        _exceptSource.remove(person);
        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
    });
});

class Person {
    constructor(public  name: string, public age: number) {
    }
}