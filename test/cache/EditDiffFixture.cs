
using System;
using System.Linq;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Xunit;

namespace DynamicData.Tests.Cache
{

    public class EditDiffFixture: IDisposable
    {
        let _cache: SourceCache<Person, string>;
        let _result: ChangeSetAggregator<Person, string>;

        public  EditDiffFixture()
        {
            _cache = new SourceCache<Person, string>(p => p.Name);
            _result = _cache.Connect().AsAggregator();
            _cache.AddOrUpdate(Enumerable.Range(1, 10).Select(i => new Person("Name" + i, i)).ToArray());
        }

        afterEach(() => {
            _cache.Dispose();
            _result.Dispose();
         });

        it('New', () => {
            var newPeople = Enumerable.Range(1, 15).Select(i => new Person("Name" + i, i)).ToArray();

            _cache.EditDiff(newPeople, (current, previous) => Person.AgeComparer.Equals(current, previous));

            expect(_cache.Count).toBe(15);
            _cache.Items.ShouldAllBeEquivalentTo(newPeople);
            var lastChange = _result.Messages.Last();
            expect(lastChange.Adds).toBe(5);
        });        it('EditWithSameData', () => {
            var newPeople = Enumerable.Range(1, 10).Select(i => new Person("Name" + i, i)).ToArray();

            _cache.EditDiff(newPeople, (current, previous) => Person.AgeComparer.Equals(current, previous));

            expect(_cache.Count).toBe(10);
            _cache.Items.ShouldAllBeEquivalentTo(newPeople);
            expect(_result.messages.length).toBe(1);
        });        it('Amends', () => {
            var newList = Enumerable.Range(5, 3).Select(i => new Person("Name" + i, i + 10)).ToArray();
            _cache.EditDiff(newList, (current, previous) => Person.AgeComparer.Equals(current, previous));

            expect(_cache.Count).toBe(3);

            var lastChange = _result.Messages.Last();
            expect(lastChange.Adds).toBe(0);
            expect(lastChange.Updates).toBe(3);
            expect(lastChange.Removes).toBe(7);

            _cache.Items.ShouldAllBeEquivalentTo(newList);
        });        it('Removes', () => {
            var newList = Enumerable.Range(1, 7).Select(i => new Person("Name" + i, i)).ToArray();
            _cache.EditDiff(newList, (current, previous) => Person.AgeComparer.Equals(current, previous));

            expect(_cache.Count).toBe(7);

            var lastChange = _result.Messages.Last();
            expect(lastChange.Adds).toBe(0);
            expect(lastChange.Updates).toBe(0);
            expect(lastChange.Removes).toBe(3);

            _cache.Items.ShouldAllBeEquivalentTo(newList);
        });        it('VariousChanges', () => {
            var newList = Enumerable.Range(6, 10).Select(i => new Person("Name" + i, i + 10)).ToArray();

            _cache.EditDiff(newList, (current, previous) => Person.AgeComparer.Equals(current, previous));

            expect(_cache.Count).toBe(10);

            var lastChange = _result.Messages.Last();
            expect(lastChange.Adds).toBe(5);
            expect(lastChange.Updates).toBe(5);
            expect(lastChange.Removes).toBe(5);

            _cache.Items.ShouldAllBeEquivalentTo(newList);
        });        it('New_WithEqualityComparer', () => {
            var newPeople = Enumerable.Range(1, 15).Select(i => new Person("Name" + i, i)).ToArray();

            _cache.EditDiff(newPeople, Person.AgeComparer);

            expect(_cache.Count).toBe(15);
            _cache.Items.ShouldAllBeEquivalentTo(newPeople);
            var lastChange = _result.Messages.Last();
            expect(lastChange.Adds).toBe(5);
        });        it('EditWithSameData_WithEqualityComparer', () => {
            var newPeople = Enumerable.Range(1, 10).Select(i => new Person("Name" + i, i)).ToArray();

            _cache.EditDiff(newPeople, Person.AgeComparer);

            expect(_cache.Count).toBe(10);
            _cache.Items.ShouldAllBeEquivalentTo(newPeople);
            var lastChange = _result.Messages.Last();
            expect(_result.messages.length).toBe(1);
        });        it('Amends_WithEqualityComparer', () => {
            var newList = Enumerable.Range(5, 3).Select(i => new Person("Name" + i, i + 10)).ToArray();
            _cache.EditDiff(newList, Person.AgeComparer);

            expect(_cache.Count).toBe(3);

            var lastChange = _result.Messages.Last();
            expect(lastChange.Adds).toBe(0);
            expect(lastChange.Updates).toBe(3);
            expect(lastChange.Removes).toBe(7);

            _cache.Items.ShouldAllBeEquivalentTo(newList);
        });        it('Removes_WithEqualityComparer', () => {
            var newList = Enumerable.Range(1, 7).Select(i => new Person("Name" + i, i)).ToArray();
            _cache.EditDiff(newList, Person.AgeComparer);

            expect(_cache.Count).toBe(7);

            var lastChange = _result.Messages.Last();
            expect(lastChange.Adds).toBe(0);
            expect(lastChange.Updates).toBe(0);
            expect(lastChange.Removes).toBe(3);

            _cache.Items.ShouldAllBeEquivalentTo(newList);
        });        it('VariousChanges_WithEqualityComparer', () => {
            var newList = Enumerable.Range(6, 10).Select(i => new Person("Name" + i, i + 10)).ToArray();

            _cache.EditDiff(newList, Person.AgeComparer);

            expect(_cache.Count).toBe(10);

            var lastChange = _result.Messages.Last();
            expect(lastChange.Adds).toBe(5);
            expect(lastChange.Updates).toBe(5);
            expect(lastChange.Removes).toBe(5);

            _cache.Items.ShouldAllBeEquivalentTo(newList);
        });   }
}
