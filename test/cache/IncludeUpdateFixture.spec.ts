import { ISourceCache } from '../../src/cache/ISourceCache';
import { Person } from '../domain/Person';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { includeUpdateWhen } from '../../src/cache/operators/includeUpdateWhen';

describe('IncludeUpdateFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.key));
        _results = new ChangeSetAggregator<Person, string>(
            _source.connect()
                .pipe(includeUpdateWhen((current, previous) => current !== previous)),
        );
    });

    afterEach(() => {
        _source.dispose();
    });

    it('IgnoreFunctionWillIgnoreSubsequentUpdatesOfAnItem', () => {
        var person = new Person('Person', 10);
        _source.addOrUpdate(person);
        _source.addOrUpdate(person);
        _source.addOrUpdate(person);

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
    });
});
