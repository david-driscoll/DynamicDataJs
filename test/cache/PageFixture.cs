using System;
using System.Collections.Generic;
using System.Linq;
using System.Reactive.Subjects;
using DynamicData.Binding;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Xunit;

namespace DynamicData.Tests.Cache
{

    public class PageFixture: IDisposable
    {
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _aggregators: PagedChangeSetAggregator<Person, string>;

        private readonly RandomPersonGenerator _generator = new RandomPersonGenerator();
        let _comparer: IComparer<Person>;
        let _sort: ISubject<IComparer<Person>>;
        let _pager: ISubject<IPageRequest>;

        public  PageFixture()
        {
            _source = updateable(new SourceCache<Person, string>((p=>p.Name)));
            _comparer = SortExpressionComparer<Person>.Ascending(p => p.Name).ThenByAscending(p => p.Age);
            _sort = new BehaviorSubject<IComparer<Person>>(_comparer);
            _pager = new BehaviorSubject<IPageRequest>(new PageRequest(1, 25));

            _aggregators = _source.Connect()
                .Sort(_sort, resetThreshold: 200)
                .Page(_pager)
                .AsAggregator();
        }

        afterEach(() => {
            _source.Dispose();
            _aggregators.Dispose();
         });

        it('ReorderBelowThreshold', () => {
            var people = _generator.Take(50).ToArray();
            _source.AddOrUpdate(people);

            var changed = SortExpressionComparer<Person>.Descending(p => p.Age).ThenByAscending(p => p.Name);
            _sort.OnNext(changed);

            var expectedResult = people.OrderBy(p => p, changed).Take(25).Select(p => new KeyValuePair<string, Person>(p.Name, p)).ToList();
            var actualResult = _aggregators.Messages.Last().SortedItems.ToList();
            actualResult.ShouldAllBeEquivalentTo(expectedResult);
        });        it('PageInitialBatch', () => {
            var people = _generator.Take(100).ToArray();
            _source.AddOrUpdate(people);

            expect(_aggregators.data.size).toBe(25);
            expect(_aggregators.Messages[0].Response.PageSize).toBe(25);
            expect(_aggregators.Messages[0].Response.Page).toBe(1);
            expect(_aggregators.Messages[0].Response.Pages).toBe(4);

            var expectedResult = people.OrderBy(p => p, _comparer).Take(25).Select(p => new KeyValuePair<string, Person>(p.Name, p)).ToList();
            var actualResult = _aggregators.Messages[0].SortedItems.ToList();

            actualResult.ShouldAllBeEquivalentTo(expectedResult);
        });        it('ChangePage', () => {
            var people = _generator.Take(100).ToArray();
            _source.AddOrUpdate(people);
            _pager.OnNext(new PageRequest(2, 25));

            var expectedResult = people.OrderBy(p => p, _comparer).Skip(25).Take(25).Select(p => new KeyValuePair<string, Person>(p.Name, p)).ToList();
            var actualResult = _aggregators.Messages[1].SortedItems.ToList();

            actualResult.ShouldAllBeEquivalentTo(expectedResult);
        });        it('ChangePageSize', () => {
            var people = _generator.Take(100).ToArray();
            _source.AddOrUpdate(people);
            _pager.OnNext(new PageRequest(1, 50));

            expect(_aggregators.Messages[1].Response.Page).toBe(1);

            var expectedResult = people.OrderBy(p => p, _comparer).Take(50).Select(p => new KeyValuePair<string, Person>(p.Name, p)).ToList();
            var actualResult = _aggregators.Messages[1].SortedItems.ToList();

            actualResult.ShouldAllBeEquivalentTo(expectedResult);
        });        it('PageGreaterThanNumberOfPagesAvailable', () => {
            var people = _generator.Take(100).ToArray();
            _source.AddOrUpdate(people);
            _pager.OnNext(new PageRequest(10, 25));

            expect(_aggregators.Messages[1].Response.Page).toBe(4);

            var expectedResult = people.OrderBy(p => p, _comparer).Skip(75).Take(25).Select(p => new KeyValuePair<string, Person>(p.Name, p)).ToList();
            var actualResult = _aggregators.Messages[1].SortedItems.ToList();

            actualResult.ShouldAllBeEquivalentTo(expectedResult);
        });        it('ThrowsForNegativeSizeParameters', () => {
            Assert.Throws<ArgumentException>(() => _pager.OnNext(new PageRequest(1, -1)));
        });        it('ThrowsForNegativePage', () => {
            Assert.Throws<ArgumentException>(() => _pager.OnNext(new PageRequest(-1, 1)));
        });   }
}
