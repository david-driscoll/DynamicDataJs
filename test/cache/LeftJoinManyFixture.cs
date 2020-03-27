using System;
using System.Linq;
using DynamicData.Kernel;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Xunit;

namespace DynamicData.Tests.Cache
{
    public class LeftJoinManyFixture: IDisposable
    {
        let _people: SourceCache<Person, string>;
        let _result: ChangeSetAggregator<ParentAndChildren, string>;

        public  LeftJoinManyFixture()
        {
            _people = new SourceCache<Person, string>(p => p.Name);

            _result = _people.Connect()
                .LeftJoinMany(_people.Connect(), pac => pac.ParentName, (person, grouping) => new ParentAndChildren(person, grouping.Items.Select(p => p).ToArray()))
                .AsAggregator();
        }

        afterEach(() => {
            _people.Dispose();
            _result.Dispose();
         });

        it('AddLeftOnly', () => {
            var people = Enumerable.Range(1, 10)
                .Select(i => new Person("Person" + i, i))
                .ToArray();

            _people.AddOrUpdate(people);

            expect(_result.data.size).toBe(10);
            _result.Data.Items.Select(pac => pac.Parent).ShouldAllBeEquivalentTo(people);

            expect(_result.Data.Items.ForEach(pac => { pac.Count).toBe(0); });
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

            var updatedPeople = people.Take(9).Union(new[] {person10}).ToArray();

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

            var updatedPeople = people.Where(p => p.Name != "Person6").Union(new[] {person6}).ToArray();

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

            var updatedPeople = people.Union(new[] {person11}).ToArray();

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

            AssertDataIsCorrectlyFormed(updatedPeople, last.Name);
        });        private void AssertDataIsCorrectlyFormed(Person[] expected, params string[] missingParents)
        {
            expect(_result.data.size).toBe(expected.Length);
            _result.Data.Items.Select(pac => pac.Parent).ShouldAllBeEquivalentTo(expected);

            expected.GroupBy(p => p.ParentName)
                .ForEach(grouping =>
                {
                    if (missingParents.Length > 0 && missingParents.Contains(grouping.Key))
                    {
                        return;
                    }

                    var result = _result.Data.Lookup(grouping.Key)
                        .ValueOrThrow(() => new Exception("Missing result for " + grouping.Key));

                    var children = result.Children;
                    children.ShouldAllBeEquivalentTo(grouping);
                });
        }

        private int CalculateParent(int index, int totalPeople)
        {
            if (index < 5)
            {
                return 10;
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