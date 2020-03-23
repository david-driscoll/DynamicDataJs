import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { Person } from '../domain/Person';
import { ChangeSetAggregator } from '../util/aggregator';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ignoreUpdateWhen } from '../../src/cache/operators/ignoreUpdateWhen';

describe('IgnoreUpdateFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.key));
        _results = new ChangeSetAggregator<Person, string>(
            _source.connect()
                .pipe(ignoreUpdateWhen((current, previous) => current === previous)),
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