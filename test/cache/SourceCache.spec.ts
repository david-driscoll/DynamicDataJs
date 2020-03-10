import { SourceCache } from '../../src/cache/SourceCache';
import { asAggregator } from '../util/aggregator';

export interface Person
{
    name: string;
    age: number;
}


describe('SourceCacheFixture', () => {
    let _source = new SourceCache<Person, string>(p => p.name);
    let _results = asAggregator(_source.connect());
    beforeEach(() => {

    });
    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('Can handle a batch of updates', () => {
        _source.edit(updater =>
        {
            const torequery: Person = { name: 'Adult1', age: 44 };

            updater.addOrUpdate({ name: "Adult1", age: 40});
            updater.addOrUpdate({ name: "Adult1", age: 41});
            updater.addOrUpdate({ name: "Adult1", age: 42});
            updater.addOrUpdate({ name: "Adult1", age: 43});
            updater.refresh(torequery);
            updater.remove(torequery);
            updater.refresh(torequery);
        });

        expect(_results.summary.overall.count).toBe(6);
        expect(_results.messages.length).toBe(1);
        expect(_results.messages[0].adds).toBe(1);
        expect(_results.messages[0].updates).toBe(3);
        expect(_results.messages[0].removes).toBe(1);
        expect(_results.messages[0].refreshes).toBe(1);

        expect(_results.data.size).toBe(0);
    });
});
//     [Fact]
// public void CanHandleABatchOfUpdates()
//     {
//         _source.Edit(updater =>
//         {
//             var torequery = { name: "Adult1", 44);
//
//             updater.AddOrUpdate({ name: "Adult1", age: 40});
//             updater.AddOrUpdate({ name: "Adult1", age: 41});
//             updater.AddOrUpdate({ name: "Adult1", age: 42});
//             updater.AddOrUpdate({ name: "Adult1", age: 43});
//             updater.Refresh(torequery);
//             updater.Remove(torequery);
//             updater.Refresh(torequery);
//         });
//
//         _results.Summary.Overall.Count).toBe(6, "Should be  6 up`dates");
//         _results.Messages.Count).toBe(1, "Should be 1 message");
//         _results.Messages[0].Adds).toBe(1, "Should be 1 update");
//         _results.Messages[0].Updates).toBe(3, "Should be 3 updates");
//         _results.Messages[0].Removes).toBe(1, "Should be  1 remove");
//         _results.Messages[0].Refreshes).toBe(1, "Should be 1 evaluate");
//
//         _results.Data.Count).toBe(0, "Should be 1 item in` the cache");
//     }
//
//     [Fact]
// public void CountChangedShouldAlwaysInvokeUponeSubscription()
//     {
//         int? result = null;
//         var subscription = _source.CountChanged.Subscribe(count => result = count);
//
//         result.HasValue.Should().BeTrue();
//         result.Value).toBe(0, "Count should be zero");
//
//         subscription.Dispose();
//     }
//
//     [Fact]
// public void CountChangedShouldReflectContentsOfCacheInvokeUponSubscription()
//     {
//         var generator = new RandomPersonGenerator();
//         int? result = null;
//         var subscription = _source.CountChanged.Subscribe(count => result = count);
//
//         _source.AddOrUpdate(generator.Take(100));
//
//         result.HasValue.Should().BeTrue();
//         result.Value).toBe(100, "Count should be 100");
//         subscription.Dispose();
//     }
//
//     [Fact]
// public void SubscribesDisposesCorrectly()
//     {
//         bool called = false;
//         bool errored = false;
//         bool completed = false;
//         var subscription = _source.Connect()
//             .Finally(() => completed = true)
//             .Subscribe(updates => { called = true; }, ex => errored = true, () => completed = true);
//         _source.AddOrUpdate({ name: "Adult1", age: 40});
//
//         subscription.Dispose();
//         _source.Dispose();
//
//         errored.Should().BeFalse();
//         called.Should().BeTrue();
//         completed.Should().BeTrue();
//     }
//
//     [Fact]
// public void CountChanged()
//     {
//         int count = 0;
//         int invoked = 0;
//         using (_source.CountChanged.Subscribe(c =>
//         {
//             count = c;
//             invoked++;
//         }))
//         {
//             invoked).toBe(1);
//             count).toBe(0);
//
//             _source.AddOrUpdate(new RandomPersonGenerator().Take(100));
//             invoked).toBe(2);
//             count).toBe(100);
//
//             _source.Clear();
//             invoked).toBe(3);
//             count).toBe(0);
//         }
//     }
// }