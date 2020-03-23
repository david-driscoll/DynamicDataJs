import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { PersonWithFriends } from '../domain/PersonWithFriends';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { autoRefresh } from '../../src/cache/operators/autoRefresh';
import { transformMany } from '../../src/cache/operators/transformMany';

describe('TransformManyRefreshFixture', () => {
    let _source: ISourceCache<PersonWithFriends, string> & ISourceUpdater<PersonWithFriends, string>;
    let _results: ChangeSetAggregator<PersonWithFriends, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<PersonWithFriends, string>(p => p.key));
        _results = asAggregator(
            _source.connect()
                .pipe(
                    autoRefresh(),
                    transformMany(p => p.friends, p => p.name),
                ));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('AutoRefresh', () => {
        const person = new PersonWithFriends('Person', 50);
        _source.addOrUpdate(person);

        person.friends = [
            new PersonWithFriends('Friend1', 40),
            new PersonWithFriends('Friend2', 45),
        ];
        expect(_results.data.size).toBe(2);
        expect(_results.data.lookup('Friend1')).toBeDefined();
        expect(_results.data.lookup('Friend2')).toBeDefined();
    });

    it('AutoRefreshOnOtherProperty', () => {
        const friends = [new PersonWithFriends('Friend1', 40)];
        const person = new PersonWithFriends('Person', 50, friends);
        _source.addOrUpdate(person);

        friends.push(new PersonWithFriends('Friend2', 45));
        person.age = 55;

        expect(_results.data.size).toBe(2);
        expect(_results.data.lookup('Friend1')).toBeDefined();
        expect(_results.data.lookup('Friend2')).toBeDefined();
    });

    it('DirectRefresh', () => {
        const friends = [new PersonWithFriends('Friend1', 40)];
        const person = new PersonWithFriends('Person', 50, friends);
        _source.addOrUpdate(person);

        friends.push(new PersonWithFriends('Friend2', 45));
        _source.refresh(person);

        expect(_results.data.size).toBe(2);
        expect(_results.data.lookup('Friend1')).toBeDefined();
        expect(_results.data.lookup('Friend2')).toBeDefined();
    });
});