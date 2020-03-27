using System;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Microsoft.Reactive.Testing;
using Xunit;

namespace DynamicData.Tests.Cache
{
    public class BatchIfFixture: IDisposable
    {
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _results: ChangeSetAggregator<Person, string>;
        let _scheduler: TestScheduler;
        private readonly ISubject<bool> _pausingSubject = new Subject<bool>();

        public  BatchIfFixture()
        {
            _scheduler = new TestScheduler();
            _source = updateable(new SourceCache<Person, string>((p => p.Key)));
            _results = _source.Connect().BatchIf(_pausingSubject, _scheduler).AsAggregator();

           // _results = _source.Connect().BatchIf(new BehaviorSubject<bool>(true), scheduler: _scheduler).AsAggregator();
        }

        afterEach(() => {
            _results.Dispose();
            _source.Dispose();
         });

        /// <summary>
        /// Test case to prove the issue and fix to DynamicData GitHub issue #98 - BatchIf race condition
        /// </summary>
        it('ChangesNotLostIfConsumerIsRunningOnDifferentThread', () => {

            var producerScheduler = new TestScheduler();
            var consumerScheduler = new TestScheduler();

            //Note consumer is running on a different scheduler
            _source.Connect()
                   .BatchIf(_pausingSubject, producerScheduler)
                   .ObserveOn(consumerScheduler)
                   .Bind(out var target)
                   .AsAggregator();

            _source.AddOrUpdate(new Person("A", 1));

            producerScheduler.AdvanceBy(1);
            consumerScheduler.AdvanceBy(1);

            expect(target.Count).toBe(1);

            _pausingSubject.OnNext(true);

            producerScheduler.AdvanceBy(1);
            consumerScheduler.AdvanceBy(1);

            _source.AddOrUpdate(new Person("B", 2));

            producerScheduler.AdvanceBy(1);
            consumerScheduler.AdvanceBy(1);

            expect(target.Count).toBe(1);

            _pausingSubject.OnNext(false);

            producerScheduler.AdvanceBy(1);

            //Target doesnt get the messages until its scheduler runs, but the
            //messages shouldnt be lost
            expect(target.Count).toBe(1);

            consumerScheduler.AdvanceBy(1);

            expect(target.Count).toBe(2);
        });        it('NoResultsWillBeReceivedIfPaused', () => {
            _pausingSubject.OnNext(true);
            //advance otherwise nothing happens
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(10).Ticks);

            _source.AddOrUpdate(new Person("A", 1));

            //go forward an arbitary amount of time
            _scheduler.AdvanceBy(TimeSpan.FromMinutes(1).Ticks);
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
            _scheduler.AdvanceBy(TimeSpan.FromMinutes(1).Ticks);
            expect(_results.messages.length).toBe(0);

            _pausingSubject.OnNext(false);
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(10).Ticks);

            _source.AddOrUpdate(new Person("B", 1));

            expect(_results.messages.length).toBe(2);

            _pausingSubject.OnNext(true);
            ////advance otherwise nothing happens
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(10).Ticks);

            _source.AddOrUpdate(new Person("C", 1));

            //go forward an arbitary amount of time
            _scheduler.AdvanceBy(TimeSpan.FromMinutes(1).Ticks);
            expect(_results.messages.length).toBe(2);

            _pausingSubject.OnNext(false);
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(10).Ticks);

            expect(_results.messages.length).toBe(3);
        });   }
}
