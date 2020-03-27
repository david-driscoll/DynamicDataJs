using System;
using System.Reactive;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Microsoft.Reactive.Testing;
using Xunit;

namespace DynamicData.Tests.Cache
{
    public class BatchIfWithTimeoutFixture : IDisposable
    {
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _scheduler: TestScheduler;

        beforeEach(() => {
            _scheduler = new TestScheduler();
            _source = updateable(new SourceCache<Person, string>((p => p.Key)));
         });

        it('InitialPause', () => {
            var pausingSubject = new Subject<bool>();
            var results = _source.Connect().BatchIf(pausingSubject, true, _scheduler).AsAggregator()//dispose

                // no results because the initial pause state is pause
                _source.AddOrUpdate(new Person("A", 1));
                expect(results.data.size).toBe(0);

                //resume and expect a result
                pausingSubject.OnNext(false);
                expect(results.data.size).toBe(1);

                //add another in the window where there is no pause
                _source.AddOrUpdate(new Person("B", 1));
                expect(results.data.size).toBe(2);

                // pause again
                pausingSubject.OnNext(true);
                _source.AddOrUpdate(new Person("C", 1));
                expect(results.data.size).toBe(2);

                //resume for the second time
                pausingSubject.OnNext(false);
                expect(results.data.size).toBe(3);
             // dispose var results = _source.Connect().BatchIf(pausingSubject, true, _scheduler).AsAggregator()
        });        it('Timeout', () => {
            var pausingSubject = new Subject<bool>();
            var results = _source.Connect().BatchIf(pausingSubject, TimeSpan.FromSeconds(1), _scheduler).AsAggregator()//dispose

                // no results because the initial pause state is pause
                _source.AddOrUpdate(new Person("A", 1));
                expect(results.data.size).toBe(1);

                // pause and add
                pausingSubject.OnNext(true);
                _source.AddOrUpdate(new Person("B", 1));
                expect(results.data.size).toBe(1);

                //resume before timeout ends
                _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(500).Ticks);
                expect(results.data.size).toBe(1);

                pausingSubject.OnNext(false);
                expect(results.data.size).toBe(2);

                //pause and advance past timeout window
                pausingSubject.OnNext(true);
                _source.AddOrUpdate(new Person("C", 1));
                _scheduler.AdvanceBy(TimeSpan.FromSeconds(2.1).Ticks);
                expect(results.data.size).toBe(3);

                _source.AddOrUpdate(new Person("D", 1));
                expect(results.data.size).toBe(4);
             // dispose var results = _source.Connect().BatchIf(pausingSubject, TimeSpan.FromSeconds(1), _scheduler).AsAggregator()
        });        afterEach(() => {
            _source.Dispose();
         });

    }

    public class BatchIfWithTimeOutFixture : IDisposable
    {
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _results: ChangeSetAggregator<Person, string>;
        let _scheduler: TestScheduler;
        private readonly ISubject<bool> _pausingSubject = new Subject<bool>();

        beforeEach(() => {
            _scheduler = new TestScheduler();
            _source = updateable(new SourceCache<Person, string>((p => p.Key)));
            _results = _source.Connect().BatchIf(_pausingSubject, TimeSpan.FromMinutes(1), _scheduler).AsAggregator();
         });

        afterEach(() => {
            _results.Dispose();
            _source.Dispose();
            _pausingSubject.OnCompleted();
         });

        it('WillApplyTimeout', () => {
            _pausingSubject.OnNext(true);

            //should timeout 
            _scheduler.AdvanceBy(TimeSpan.FromSeconds(61).Ticks);

            _source.AddOrUpdate(new Person("A", 1));

            expect(_results.messages.length).toBe(1);
        });        it('NoResultsWillBeReceivedIfPaused', () => {
            _pausingSubject.OnNext(true);
            //advance otherwise nothing happens
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(10).Ticks);

            _source.AddOrUpdate(new Person("A", 1));

            expect(_results.messages.length).toBe(0);
        });        it('ResultsWillBeReceivedIfNotPaused', () => {
            _source.AddOrUpdate(new Person("A", 1));

            //go forward an arbitary amount of time
            _scheduler.AdvanceBy(TimeSpan.FromMinutes(1).Ticks);
            expect(_results.messages.length).toBe(1);
        });        it('CanToggleSuspendResume', () => {
            _pausingSubject.OnNext(true);
            ////advance otherwise nothing happens
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(10).Ticks);

            _source.AddOrUpdate(new Person("A", 1));

            //go forward an arbitary amount of time
            expect(_results.messages.length).toBe(0);

            _pausingSubject.OnNext(false);
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(10).Ticks);

            _source.AddOrUpdate(new Person("B", 1));

            expect(_results.messages.length).toBe(2);
        });        it('PublishesOnTimerCompletion', () => {
            var intervalTimer = Observable.Timer(TimeSpan.FromMilliseconds(5), _scheduler).Select(_ => Unit.Default);
            var results = _source.Connect().BatchIf(_pausingSubject, true, intervalTimer, _scheduler).AsAggregator();

            //Buffering
            _source.AddOrUpdate(new Person("A", 1));
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(1).Ticks);
            expect(results.messages.length).toBe(0);

            //Timer should event, buffered items delivered
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(5).Ticks);
            expect(results.messages.length).toBe(1);

            //Unbuffered from here
            _source.AddOrUpdate(new Person("B", 2));
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(1).Ticks);
            expect(results.messages.length).toBe(2);

            //Unbuffered from here
            _source.AddOrUpdate(new Person("C", 3));
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(1).Ticks);
            expect(results.messages.length).toBe(3);
        });        it('PublishesOnIntervalEvent', () => {
            var intervalTimer = Observable.Interval(TimeSpan.FromMilliseconds(5), _scheduler).Select(_ => Unit.Default);
            var results = _source.Connect().BatchIf(_pausingSubject, true, intervalTimer, _scheduler).AsAggregator();

            //Buffering
            _source.AddOrUpdate(new Person("A", 1));
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(1).Ticks);
            expect(results.messages.length).toBe(0);

            //Interval Fires and drains buffer
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(5).Ticks);
            expect(results.messages.length).toBe(1);

            //Buffering again
            _source.AddOrUpdate(new Person("B", 2));
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(1).Ticks);
            expect(results.messages.length).toBe(1);

            //Interval Fires and drains buffer
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(5).Ticks);
            expect(results.messages.length).toBe(2);

            //Buffering again
            _source.AddOrUpdate(new Person("C", 3));
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(1).Ticks);
            expect(results.messages.length).toBe(2);

            //Interval Fires and drains buffer
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(5).Ticks);
            expect(results.messages.length).toBe(3);
        });   }
}
