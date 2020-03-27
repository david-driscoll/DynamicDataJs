using System;
using System.Linq;
using System.Reactive.Subjects;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Xunit;

namespace DynamicData.Tests.Cache
{

    public class SwitchFixture: IDisposable
    {
        let _switchable: ISubject<ISourceCache<Person, string>>;
        let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
        let _results: ChangeSetAggregator<Person, string>;

        public  SwitchFixture()
        {
            _source = updateable(new SourceCache<Person, string>((p => p.Name)));
            _switchable = new BehaviorSubject<ISourceCache<Person, string>>(_source);
            _results = _switchable.Switch().AsAggregator();
        }

        afterEach(() => {
            _source.Dispose();
            _results.Dispose();
         });

        it('PoulatesFirstSource', () => {
            var inital = Enumerable.Range(1, 100).Select(i => new Person("Person" + i, i)).ToArray();
            _source.AddOrUpdate(inital);

            expect(_results.data.size).toBe(100);
        });        it('ClearsForNewSource', () => {
            var inital = Enumerable.Range(1, 100).Select(i => new Person("Person" + i, i)).ToArray();
            _source.AddOrUpdate(inital);

            expect(_results.data.size).toBe(100);

            var newSource = new SourceCache<Person, string>(p => p.Name);
            _switchable.OnNext(newSource);

            expect(_results.data.size).toBe(0);

            newSource.AddOrUpdate(inital);
            expect(_results.data.size).toBe(100);

            var nextUpdates = Enumerable.Range(101, 100).Select(i => new Person("Person" + i, i)).ToArray();
            newSource.AddOrUpdate(nextUpdates);
            expect(_results.data.size).toBe(200);

        });    }
}
