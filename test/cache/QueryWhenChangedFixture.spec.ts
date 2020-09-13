import { ISourceCache } from '../../src/cache/ISourceCache';
import { ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { Person } from '../domain/Person';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { queryWhenChanged } from '../../src/cache/operators/queryWhenChanged';

describe('QueryWhenChangedFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _results = new ChangeSetAggregator<Person, string>(_source.connect(p => p.age > 20));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('ChangeInvokedOnSubscriptionIfItHasData', () => {
        let invoked = false;
        _source.addOrUpdate(new Person('A', 1));
        const subscription = _source
            .connect()
            .pipe(queryWhenChanged())
            .subscribe(x => (invoked = true));
        expect(invoked).toBe(true);
        subscription.unsubscribe();
    });

    it('ChangeInvokedOnNext', () => {
        let invoked = false;

        const subscription = _source
            .connect()
            .pipe(queryWhenChanged())
            .subscribe(x => (invoked = true));

        expect(invoked).toBe(false);

        _source.addOrUpdate(new Person('A', 1));
        expect(invoked).toBe(true);

        subscription.unsubscribe();
    });

    it('ChangeInvokedOnSubscriptionIfItHasData_WithSelector', () => {
        let invoked = false;
        _source.addOrUpdate(new Person('A', 1));
        const subscription = _source
            .connect()
            .pipe(queryWhenChanged())
            .subscribe(x => (invoked = true));
        expect(invoked).toBe(true);
        subscription.unsubscribe();
    });

    it('ChangeInvokedOnNext_WithSelector', () => {
        let invoked = false;

        const subscription = _source
            .connect()
            .pipe(queryWhenChanged())
            .subscribe(x => (invoked = true));

        expect(invoked).toBe(false);

        _source.addOrUpdate(new Person('A', 1));
        expect(invoked).toBe(true);

        subscription.unsubscribe();
    });
});
