import { SourceCache, updatable } from '../../src/cache/SourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { IChangeSet } from '../../src/cache/IChangeSet';
import faker from 'faker'
import { finalize } from 'rxjs/operators';
import { using } from '../../src/util';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { ISourceCache } from '../../src/cache/ISourceCache';

export interface Person
{
    name: string;
    age: number;
}

describe('SourceCacheFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<IChangeSet<Person, string>>;
    beforeEach(() => {
        _source= updatable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(_source.connect());
    });
    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('Can handle a batch of updates', () => {
        _source.edit(updater =>
        {
            const torequery: Person = { name: 'Adult1', age: 44 };

            updater.addOrUpdate({ name: "Adult1", age: 40});
            updater.addOrUpdate({ name: "Adult1", age: 41});
            updater.addOrUpdate({ name: "Adult1", age: 42});
            updater.addOrUpdate({ name: "Adult1", age: 43});
            updater.refresh(torequery);
            updater.remove(torequery);
            updater.refresh(torequery);
        });

        expect(_results.summary.overall.count).toBe(6);
        expect(_results.messages.length).toBe(1);
        expect(_results.messages[0].adds).toBe(1);
        expect(_results.messages[0].updates).toBe(3);
        expect(_results.messages[0].removes).toBe(1);
        expect(_results.messages[0].refreshes).toBe(1);

        expect(_results.data.size).toBe(0);
    });

    it ('Count changed should always invoke upon subscription', () => {

        let result: number | undefined ;
        const subscription = _source.countChanged.subscribe(count => result = count);

        expect(result).toBeDefined();
        expect(result).toBe(0);

        subscription.unsubscribe();
    });

    it ('Count changed should reflect contents of cache invoke upon subscription', () => {

        let result: number | undefined;
        const subscription = _source.countChanged.subscribe(count => result = count);

        const data: Person[] = [];
        for (let i = 0; i < 100; i++) data.push({ name: faker.random.alphaNumeric(20) , age: faker.random.number({ min: 1, max: 100 }) });

        _source.edit(updater => updater.addOrUpdateValues(data));

        expect(result).toBeDefined();
        expect(result).toBe(100);
        subscription.unsubscribe();
    });
    
    it ('Subscribes disposes correctly', () => {

        let called = false;
        let errored = false;
        let completed = false;
        const subscription = _source.connect()
            .pipe(
                finalize(() => completed = true),
            )
            .subscribe(updates => { called = true; }, ex => errored = true, () => completed = true);
        _source.edit(updater => updater.addOrUpdate({ name: "Adult1", age: 40}));

        subscription.unsubscribe();
        _source.dispose();

        expect(errored).toBeFalsy();
        expect(called).toBeTruthy();
        expect(completed).toBeTruthy();
    });

    it('Count changed', () => {

        let count = 0;
        let invoked = 0;
        using(_source.countChanged.subscribe(c =>
        {
            count = c;
            invoked++;
        }), () => {

            expect(invoked).toBe(1);
            expect(count).toBe(0);

            const data: Person[] = [];
            for (let i = 0; i < 100; i++) data.push({ name: faker.random.alphaNumeric(20) , age: faker.random.number({ min: 1, max: 100 }) });


            _source.edit(updater => updater.addOrUpdateValues(data));
            expect(invoked).toBe(2);
            expect(count).toBe(100);

            _source.edit(updater => updater.clear());
            expect(invoked).toBe(3);
            expect(count).toBe(0);
        });
    });
});
