import { Observable, Subject, interval } from 'rxjs';
import { expireAfter } from '../../src/cache/operators/expireAfter';
import { limitSizeTo } from '../../src/cache/operators/limitSizeTo';
import { TestScheduler } from 'rxjs/testing';
import { Person } from '../domain/Person';
import { toObservableChangeSet } from '../../src/cache/operators/toObservableChangeSet';
import { map, take } from 'rxjs/operators';
import { asAggregator } from '../util/aggregator';
import { from, first, range, toArray, sum } from 'ix/iterable';
import { map as ixMap, orderBy, skip } from 'ix/iterable/operators';

describe('ObservableToObservableChangeSetFixture', () => {
    it('nextFiresAdd', () => {
        const subject = new Subject<Person>();

        const results = asAggregator<Person, string>(toObservableChangeSet(subject.pipe(map(z => [z])), p => p.key));
        const person = new Person('A', 1);
        subject.next(person);

        expect(results.messages.length).toBe(1);
        expect(results.data.size).toBe(1);
        expect(first(results.data.values())).toBe(person);
    });

    it('nextForAmendedItemFiresUpdate', () => {
        const subject = new Subject<Person>();

        const results = asAggregator<Person, string>(toObservableChangeSet(subject.pipe(map(z => [z])), p => p.key));
        const person = new Person('A', 1);
        subject.next(person);

        const personamend = new Person('A', 2);
        subject.next(personamend);

        expect(results.messages.length).toBe(2);
        expect(results.messages[1].updates).toBe(1);
        expect(results.data.size).toBe(1);
        expect(first(results.data.values())).toBe(personamend);
    });

    it('nextProducesAndAddChangeForSingleItem', () => {
        const subject = new Subject<Person>();

        const results = asAggregator<Person, string>(toObservableChangeSet(subject.pipe(map(z => [z])), p => p.key));
        const person = new Person('A', 1);
        subject.next(person);

        expect(results.messages.length).toBe(1);
        expect(results.data.size).toBe(1);
        expect(first(results.data.values())).toBe(person);
    });

    it('LimitSizeTo', () => {
        const scheduler = new TestScheduler((a, b) => expect(a).toEqual(b));
        scheduler.run(({ flush }) => {
            const subject = new Subject<Person>();
            const results = asAggregator<Person, string>(toObservableChangeSet(subject.pipe(map(z => [z])), p => p.key, undefined, 100, scheduler));

            const items = toArray(range(1, 200).pipe(ixMap(i => new Person('p' + i.toString().padStart(3, '0'), i))));

            items.forEach(x => subject.next(x));

            flush();

            expect(sum(results.messages, { selector: x => x.adds })).toBe(200);
            expect(sum(results.messages, { selector: x => x.removes })).toBe(100);
            expect(results.data.size).toBe(100);

            const expected = toArray(
                from(items).pipe(
                    skip(100),
                    orderBy(p => p.name),
                ),
            );
            const actual = toArray(from(results.data.values()).pipe(orderBy(p => p.name)));
            expect(expected).toEqual(actual);
        });
    });

    it('ExpireAfterTime', () => {
        const scheduler = new TestScheduler((a, b) => expect(a).toEqual(b));
        scheduler.run(({ flush }) => {
            const subject = new Subject<Person>();
            const results = asAggregator<Person, string>(
                toObservableChangeSet(
                    subject.pipe(map(z => [z])),
                    p => p.key,
                    t => 60 * 1000,
                    undefined,
                    scheduler,
                ),
            );

            const items = toArray(range(1, 200).pipe(ixMap(i => new Person('p' + i.toString().padStart(3, '0'), i))));
            for (const person of items) {
                subject.next(person);
            }

            scheduler.schedule(() => {
                expect(results.messages.length).toBe(201);
                expect(sum(results.messages, { selector: x => x.adds })).toBe(200);
                expect(sum(results.messages, { selector: x => x.removes })).toBe(200);
                expect(results.data.size).toBe(0);
            }, 60 * 1000 + 1000);
        });
    });

    it('ExpireAfterTimeWithKey', () => {
        const scheduler = new TestScheduler((a, b) => expect(a).toEqual(b));
        scheduler.run(({ flush }) => {
            const subject = new Subject<Person>();
            const results = asAggregator<Person, string>(
                toObservableChangeSet(
                    subject.pipe(map(z => [z])),
                    p => p.key,
                    t => 60 * 1000,
                    undefined,
                    scheduler,
                ),
            );

            const items = toArray(range(1, 200).pipe(ixMap(i => new Person('p' + i.toString().padStart(3, '0'), i))));
            for (const person of items) {
                subject.next(person);
            }

            scheduler.schedule(() => {
                // expect(results.messages.length).toBe(400);
                expect(sum(results.messages, { selector: x => x.adds })).toBe(200);
                expect(sum(results.messages, { selector: x => x.removes })).toBe(200);
                expect(results.data.size).toBe(0);
            }, 60 * 1000 + 1000);
        });
    });

    it('ExpireAfterTimeDynamic', () => {
        const scheduler = new TestScheduler((a, b) => expect(a).toEqual(b));
        scheduler.run(({ flush }) => {
            const source = interval(1000, scheduler).pipe(
                take(30),
                map(i => new Person('p' + i.toString().padStart(3, '0'), i)),
            );

            const results = asAggregator<Person, string>(
                toObservableChangeSet(
                    source.pipe(map(z => [z])),
                    p => p.key,
                    t => 10000,
                    undefined,
                    scheduler,
                ),
            );

            scheduler.schedule(() => {
                expect(results.messages.length).toBe(50);
                expect(sum(results.messages, { selector: x => x.adds })).toBe(30);
                expect(sum(results.messages, { selector: x => x.removes })).toBe(20);
                expect(results.data.size).toBe(10);
            }, 30001);
        });
    });

    it('ExpireAfterTimeDynamicWithKey', () => {
        const scheduler = new TestScheduler((a, b) => expect(a).toEqual(b));
        scheduler.run(({ flush }) => {
            const source = interval(1000, scheduler).pipe(
                take(30),
                map(i => new Person('p' + i.toString().padStart(3, '0'), i)),
            );

            const results = asAggregator<Person, string>(
                toObservableChangeSet(
                    source.pipe(map(z => [z])),
                    p => p.key,
                    t => 10000,
                    undefined,
                    scheduler,
                ),
            );

            scheduler.schedule(() => {
                expect(results.messages.length).toBe(50);
                expect(sum(results.messages, { selector: x => x.adds })).toBe(30);
                expect(sum(results.messages, { selector: x => x.removes })).toBe(20);
                expect(results.data.size).toBe(10);
            }, 30001);
        });
    });
});
