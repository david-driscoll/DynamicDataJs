using System;
using System.Linq;
using DynamicData.Kernel;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Xunit;

namespace DynamicData.Tests.Cache
{
    public class FullJoinManyFixture: IDisposable
    {
        let _people: SourceCache<Person, string>;
        let _result: ChangeSetAggregator<ParentAndChildren, string>;

        beforeEach(() => {
            _people = new SourceCache<Person, string>(p => p.Name);
            _result = _people.Connect()
                .FullJoinMany(_people.Connect(), pac => pac.ParentName, (personid, person, grouping) => new ParentAndChildren(personid, person, grouping.Items.Select(p => p).ToArray()))
                .AsAggregator();
         });

        afterEach(() => {
            _people.Dispose();
            _result.Dispose();
         });

        it('AddLeftOnly', () => {
            var people = Enumerable.Range(1, 1000)
                .Select(i => new Person("Person" + i, i))
                .ToArray();

            _people.AddOrUpdate(people);
            AssertDataIsCorrectlyFormed(people);
        });        it('AddPeopleWithParents', () => {
            var people = Enumerable.Range(1, 10)
                .Select(i =>
                {
                    string parent = "Person" + CalculateParent(i, 10);
                    return new Person("Person" + i, i, parentName: parent);
                })
                .ToArray();

            _people.AddOrUpdate(people);
            AssertDataIsCorrectlyFormed(people);
        });        it('UpdateParent', () => {
            var people = Enumerable.Range(1, 10)
                .Select(i =>
                {
                    string parent = "Person" + CalculateParent(i, 10);
                    return new Person("Person" + i, i, parentName: parent);
                })
                .ToArray();

            _people.AddOrUpdate(people);

            var current10 = people.Last();
            var person10 = new Person("Person10", 100, parentName: current10.ParentName);
            _people.AddOrUpdate(person10);

            var updatedPeople = people.Take(9).Union(new[] { person10 }).ToArray();

            AssertDataIsCorrectlyFormed(updatedPeople);
        });        it('UpdateChild', () => {
            var people = Enumerable.Range(1, 10)
                .Select(i =>
                {
                    string parent = "Person" + CalculateParent(i, 10);
                    return new Person("Person" + i, i, parentName: parent);
                })
                .ToArray();

            _people.AddOrUpdate(people);

            var current6 = people[5];
            var person6 = new Person("Person6", 100, parentName: current6.ParentName);
            _people.AddOrUpdate(person6);

            var updatedPeople = people.Where(p => p.Name != "Person6").Union(new[] { person6 }).ToArray();

            AssertDataIsCorrectlyFormed(updatedPeople);
        });        it('AddChild', () => {
            var people = Enumerable.Range(1, 10)
                .Select(i =>
                {
                    string parent = "Person" + CalculateParent(i, 10);
                    return new Person("Person" + i, i, parentName: parent);
                })
                .ToArray();

            _people.AddOrUpdate(people);

            var person11 = new Person("Person11", 100, parentName: "Person3");
            _people.AddOrUpdate(person11);

            var updatedPeople = people.Union(new[] { person11 }).ToArray();

            AssertDataIsCorrectlyFormed(updatedPeople);
        });        it('RemoveChild', () => {
            var people = Enumerable.Range(1, 10)
                .Select(i =>
                {
                    string parent = "Person" + CalculateParent(i, 10);
                    return new Person("Person" + i, i, parentName: parent);
                })
                .ToArray();

            _people.AddOrUpdate(people);

            var last = people.Last();
            _people.Remove(last);

            var updatedPeople = people.Where(p => p.Name != last.Name).ToArray();

            AssertDataIsCorrectlyFormed(updatedPeople);
        });        private void AssertDataIsCorrectlyFormed(Person[] allPeople)
        {
            var people = allPeople.ToDictionary(p => p.Name);
            var parentNames = allPeople.Select(p => p.ParentName).Distinct();
            var childrenNames = allPeople.Select(p => p.Name).Distinct();

            var all = parentNames.Union(childrenNames).Distinct()
                .Select(key =>
                {
                    var parent = people.Lookup(key);
                    var children = people.Values.Where(p => p.ParentName == key).ToArray();
                    return new ParentAndChildren(key, parent, children);

                }).ToArray();

            expect(_result.data.size).toBe(all.Length);

            all.ForEach(parentAndChild =>
            {
                var result = _result.Data.Lookup(parentAndChild.ParentId).ValueOr(() => null);
                var children = result.Children;
                children.ShouldAllBeEquivalentTo(parentAndChild.Children);
            });
        }

        private int CalculateParent(int index, int totalPeople)
        {
            if (index < 5)
            {
                return 11;
            }

            if (index == totalPeople - 1)
            {
                return 1;
            }

            if (index == totalPeople)
            {
                return 1;
            }

            return index + 1;
        }

    }
}