import { ISourceCache } from '../../src/cache/ISourceCache';
import { IDisposable } from '../../src/util';
import { Person } from '../domain/Person';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { ChangeSetAggregator } from '../util/aggregator';
import { TestScheduler } from 'rxjs/testing';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { expireAfter } from '../../src/cache/operators/expireAfter';
import { Subscription } from 'rxjs';
import { range } from 'ix/iterable';
import { map } from 'ix/iterable/operators';

describe('TimeExpiryFixture', () => {
    let _cache: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _remover: Subscription;
    let _results: ChangeSetAggregator<Person, string>;
    let _scheduler: TestScheduler;

    beforeEach(() => {
        _scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
        _cache = updateable(new SourceCache<Person, string>(p => p.key));
        _results = new ChangeSetAggregator<Person, string>(_cache.connect());
        _remover = expireAfter(_cache, p => 100, _scheduler).subscribe();
    });

    afterEach(() => {
        _results.dispose();
        _remover.unsubscribe();
        _cache.dispose();
    });

    it('AutoRemove', () => {
        _scheduler.run(({ flush }) => {
            // eslint-disable-next-line unicorn/consistent-function-scoping
            function removeFunc(t: Person): number | undefined {
                if (t.age < 40) {
                    return 4000;
                }
                if (t.age < 80) {
                    return 7000;
                }

                return undefined;
            }

            const size = 100;
            const items = range(1, size).pipe(map(i => new Person(`Name${i}`, i)));
            _cache.addOrUpdateValues(items);

            const xxx = expireAfter(_cache, removeFunc, _scheduler).subscribe();
            flush();

            xxx.unsubscribe();
        });
    });

    it('ItemAddedIsExpired', () => {
        _scheduler.run(({ flush }) => {
            _cache.addOrUpdate(new Person('Name1', 10));

            flush();

            expect(_results.messages.length).toBe(2);
            expect(_results.messages[0].adds).toBe(1);
            expect(_results.messages[1].removes).toBe(1);
        });
    });

    it('ExpireIsCancelledWhenUpdated', () => {
        _scheduler.run(({ flush }) => {
            _cache.edit(updater => {
                updater.addOrUpdate(new Person('Name1', 20));
                updater.addOrUpdate(new Person('Name1', 21));
            });

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
            const items = range(1, size).pipe(map(i => new Person(`Name${i}`, i)));

            _cache.addOrUpdateValues(items);
            flush();

            expect(_results.data.size).toBe(0);
            expect(_results.messages.length).toBe(2);
            expect(_results.messages[0].adds).toBe(100);
            expect(_results.messages[1].removes).toBe(100);
        });
    });
});
