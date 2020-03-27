using System;
using System.Linq;
using System.Reactive.Linq;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Microsoft.Reactive.Testing;
using Xunit;

namespace DynamicData.Tests.Cache
{

    public class SizeLimitFixture: IDisposable
    {
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _results: ChangeSetAggregator<Person, string>;
        let _scheduler: TestScheduler;
        let _sizeLimiter: IDisposable;

        private readonly RandomPersonGenerator _generator = new RandomPersonGenerator();

        public  SizeLimitFixture()
        {
            _scheduler = new TestScheduler();
            _source = updateable(new SourceCache<Person, string>((p => p.Key)));
            _sizeLimiter = _source.LimitSizeTo(10, _scheduler).Subscribe();
            _results = _source.Connect().AsAggregator();
        }

        afterEach(() => {
            _sizeLimiter.Dispose();
            _source.Dispose();
            _results.Dispose();
         });

        it('AddLessThanLimit', () => {
            var person = _generator.Take(1).First();
            _source.AddOrUpdate(person);

            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(150).Ticks);

            expect(_results.messages.length).toBe(1);
            expect(_results.data.size).toBe(1);
            expect(_results.Data.Items.First()).toBe(person);
        });        it('AddMoreThanLimit', () => {
            var people = _generator.Take(100).OrderBy(p => p.Name).ToArray();
            _source.AddOrUpdate(people);
            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(50).Ticks);

            _source.Dispose();
            expect(_results.messages.length).toBe(2);
            expect(_results.Messages[0].Adds).toBe(100);
            expect(_results.Messages[1].Removes).toBe(90);
        });        it('AddMoreThanLimitInBatched', () => {
            _source.AddOrUpdate(_generator.Take(10).ToArray());
            _source.AddOrUpdate(_generator.Take(10).ToArray());

            _scheduler.AdvanceBy(TimeSpan.FromMilliseconds(100).Ticks);

            expect(_results.messages.length).toBe(3);
            expect(_results.Messages[0].Adds).toBe(10);
            expect(_results.Messages[1].Adds).toBe(10);
            expect(_results.Messages[2].Removes).toBe(10);
        });        it('Add', () => {
            var person = _generator.Take(1).First();
            _source.AddOrUpdate(person);

            expect(_results.messages.length).toBe(1);
            expect(_results.data.size).toBe(1);
            expect(_results.Data.Items.First()).toBe(person);
        });        it('ThrowsIfSizeLimitIsZero', () => {
            // Initialise();
            Assert.Throws<ArgumentException>(() => new SourceCache<Person, string>(p => p.Key).LimitSizeTo(0));
        });        it('OnCompleteIsInvokedWhenSourceIsDisposed', () => {
            bool completed = false;

            var subscriber = _source.LimitSizeTo(10)
                                    .Finally(() => completed = true)
                                    .Subscribe(updates => { Console.WriteLine(); });

            _source.Dispose();

            completed.Should().BeTrue();
        });   }
}
