import { ISourceCache } from '../../src/cache/ISourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { TestScheduler } from 'rxjs/testing';
import { timer, VirtualTimeScheduler } from 'rxjs';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { range, from, toArray } from 'ix/iterable';
import { map, filter } from 'ix/iterable/operators';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { expireAfter } from '../../src/cache/operators/expireAfter';
import { noop } from 'rxjs';
import { Person } from '../domain/Person';

describe('ExpireAfterFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _results: ChangeSetAggregator<Person, string>;
    let _scheduler: TestScheduler;

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _results = asAggregator(_source.connect());
        _scheduler = new TestScheduler((a, b) => expect(a).toEqual(b));
    });

    afterEach(() => {
        _results.dispose();
        _source.dispose();
        _scheduler = new TestScheduler((a, b) => expect(a).toEqual(b));
    });

    it('ComplexRemove', () => {
        _scheduler.run(({ flush }) => {
            function RemoveFunc(t: Person) {
                if (t.age <= 40) {
                    return 500;
                }
                if (t.age <= 80) {
                    return 700;
                }

                return undefined;
            }

            const size = 100;
            const items = range(1, size).pipe(map(i => new Person(`Name.${i}`, i)));
            _source.addOrUpdateValues(items);

            _scheduler.schedule(() => expect(_source.size).toBe(60), 501);
            _scheduler.schedule(() => expect(_source.size).toBe(20), 1000);

            expireAfter(_source, RemoveFunc, _scheduler).subscribe();
        });
    });

    it('ItemAddedIsExpired', () => {
        _scheduler.run(({ flush }) => {
            _source.addOrUpdate(new Person('Name1', 10));

            expireAfter(_source, p => 1).subscribe();
            flush();

            expect(_results.messages.length).toBe(2);
            expect(_results.messages[0].adds).toBe(1);
            expect(_results.messages[1].removes).toBe(1);
        });
    });

    it('ExpireIsCancelledWhenUpdated', () => {
        _scheduler.run(({ flush }) => {
            _source.edit(updater => {
                updater.addOrUpdate(new Person('Name1', 20));
                updater.addOrUpdate(new Person('Name1', 21));
            });

            expireAfter(_source, p => 100, _scheduler).subscribe();
            flush();

            expect(_results.data.size).toBe(0);
            expect(_results.messages.length).toBe(2);
            expect(_results.messages[0].adds).toBe(1);
            expect(_results.messages[0].updates).toBe(1);
            expect(_results.messages[1].removes).toBe(1);
        });
    });

    it('CanHandleABatchOfUpdates', () => {
        _scheduler.run(({ flush }) => {
            const size = 100;
            const items = range(1, size).pipe(map(i => new Person(`Name.${i}`, i)));

            _source.addOrUpdateValues(items);

            expireAfter(_source, p => 100, _scheduler).subscribe();
            flush();

            expect(_results.data.size).toBe(0);
            expect(_results.messages.length).toBe(2);
            expect(_results.messages[0].adds).toBe(100);
            expect(_results.messages[1].removes).toBe(100);
        });
    });
});
