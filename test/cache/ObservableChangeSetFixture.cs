using System;
using System.Collections.Generic;
using System.Linq;
using System.Reactive.Disposables;
using System.Reactive.Linq;
using System.Threading.Tasks;
using DynamicData.Tests.Domain;
using FluentAssertions;
using Xunit;

namespace DynamicData.Tests.Cache
{

    public class ObservableChangeSetFixture
    {

        it('LoadsAndDisposeUsingAction', () => {
            bool isDisposed = false;
            SubscribeAndAssert(ObservableChangeSet.Create<Person, string>(cache =>
            {
                Person[] people = Enumerable.Range(1, 100).Select(i => new Person($"Name.{i}", i)).ToArray();
                cache.AddOrUpdate(people);
                return () => { isDisposed = true; });            }, p => p.Name),
            expect(checkContentAction: result => result.Count).toBe(100));

            isDisposed.Should().BeTrue();
        };
        it('LoadsAndDisposeFromObservableCache', () => {
            bool isDisposed = false;

           var observable = ObservableChangeSet.Create<Person, string>(cache =>
                {
                    return () => { isDisposed = true; });                }, p => p.Name);

            observable.AsObservableCache().Dispose();
            isDisposed.Should().BeTrue();
        };
        it('LoadsAndDisposeUsingDisposable', () => {
            bool isDisposed = false;
            SubscribeAndAssert(ObservableChangeSet.Create<Person, string>(cache =>
            {
                Person[] people = Enumerable.Range(1, 100).Select(i => new Person($"Name.{i}", i)).ToArray();
                cache.AddOrUpdate(people);
                return Disposable.Create(()=> { isDisposed = true; });
            }, p => p.Name),
            expect(checkContentAction: result => result.Count).toBe(100));

            isDisposed.Should().BeTrue();
        });        it('LoadsAndDisposeUsingActionAsync', () => {
            Task<Person[]> CreateTask() => Task.FromResult(Enumerable.Range(1, 100).Select(i => new Person($"Name.{i}", i)).ToArray());

            bool isDisposed = false;
            SubscribeAndAssert(ObservableChangeSet.Create<Person, string>(async cache =>
            {
                var people = await CreateTask();
                cache.AddOrUpdate(people);
                return () => { isDisposed = true; });            }, p => p.Name),
            expect(checkContentAction: result => result.Count).toBe(100));

            isDisposed.Should().BeTrue();
        };
        it('LoadsAndDisposeUsingDisposableAsync', () => {
            Task<Person[]> CreateTask() => Task.FromResult(Enumerable.Range(1, 100).Select(i => new Person($"Name.{i}", i)).ToArray());

            bool isDisposed = false;
            SubscribeAndAssert(ObservableChangeSet.Create<Person, string>(async cache =>
            {
                var people = await CreateTask();
                cache.AddOrUpdate(people);
                return Disposable.Create(() => { isDisposed = true; });
            }, p => p.Name),
            expect(checkContentAction: result => result.Count).toBe(100));

            isDisposed.Should().BeTrue();
        });        it('HandlesAsyncError', () => {
            Exception error = null;
            Task<IEnumerable<Person>> Loader()
            {
                throw new Exception("Broken");
            });          var observable =   ObservableChangeSet.Create<Person, string>(async cache =>
            {
                var people = await Loader();
                cache.AddOrUpdate(people);
                return () => { };
            }, p => p.Name);

            var dervived = observable.AsObservableCache()//dispose var dervived = observable.AsObservableCache()
            dervived.Connect().Subscribe(_ => { }, ex => error = ex )//dispose

                error.Should().NotBeNull();
             // dispose dervived.Connect().Subscribe(_ => { }, ex => error = ex )
        }

        it('HandlesError', () => {
            Exception error = null;
            IEnumerable<Person> Loader()
            {
                throw new Exception("Broken");
            });            var observable = ObservableChangeSet.Create<Person, string>(cache =>
            {
                var people =  Loader();
                cache.AddOrUpdate(people);
                return () => { };
            }, p => p.Name);

            var dervived = observable.AsObservableCache()//dispose var dervived = observable.AsObservableCache()
            dervived.Connect().Subscribe(_ => { }, ex => error = ex)//dispose

                error.Should().NotBeNull();
             // dispose dervived.Connect().Subscribe(_ => { }, ex => error = ex)
        }

        private void SubscribeAndAssert<TObject,TKey>(IObservable<IChangeSet<TObject, TKey>> observableChangeset,
            bool expectsError = false,
            Action<IObservableCache<TObject, TKey>> checkContentAction = null)
        {
            Exception error = null;
            bool complete = false;
            IChangeSet<TObject,TKey> changes = null;

            var cache = observableChangeset.Finally(()=> complete = true).AsObservableCache()//dispose var cache = observableChangeset.Finally(()=> complete = true).AsObservableCache()
            cache.Connect().Subscribe(result => changes = result, ex => error = ex)//dispose

                if (!expectsError)
                {
                    error.Should().BeNull();
                 // dispose cache.Connect().Subscribe(result => changes = result, ex => error = ex)
                else
                {
                    error.Should().NotBeNull();
                }

                checkContentAction?.Invoke(cache);
            }

            complete.Should().BeTrue();
        }
    }
}
