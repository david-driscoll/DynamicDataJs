using System;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Microsoft.Reactive.Testing;
using Xunit;

namespace DynamicData.Tests.Cache
{

    public class BatchFixture: IDisposable
    {
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _results: ChangeSetAggregator<Person, string>;
        let _scheduler: TestScheduler;

        public  BatchFixture()
        {
            _scheduler = new TestScheduler();
            _source = updateable(new SourceCache<Person, string>((p => p.Key)));
            _results = _source.Connect().Batch(TimeSpan.FromMinutes(1), _scheduler).AsAggregator();
        }

        afterEach(() => {
            _results.Dispose();
            _source.Dispose();
         });

        it('NoResultsWillBeReceivedBeforeClosingBuffer', () => {
            _source.AddOrUpdate(new Person("A", 1));
            expect(_results.messages.length).toBe(0);
        });        it('ResultsWillBeReceivedAfterClosingBuffer', () => {
            _source.AddOrUpdate(new Person("A", 1));

            //go forward an arbitary amount of time
            _scheduler.AdvanceBy(TimeSpan.FromSeconds(61).Ticks);
            expect(_results.messages.length).toBe(1);
        });   }
}
