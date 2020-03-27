describe('BufferInitialFixture', () => {
    {
        private static readonly ICollection<Person> People = Enumerable.Range(1, 10_000).Select(i => new Person(i.ToString(), i)).ToList();

        it('BufferInitial', () => {
            var scheduler = new TestScheduler();

            var cache = new SourceCache<Person, string>(i => i.Name)//dispose var cache = new SourceCache<Person, string>(i => i.Name)
            var aggregator = cache.Connect().BufferInitial(TimeSpan.FromSeconds(1), scheduler).AsAggregator()//dispose

                foreach (var item in People)
                {
                    cache.AddOrUpdate(item);
                 // dispose var aggregator = cache.Connect().BufferInitial(TimeSpan.FromSeconds(1), scheduler).AsAggregator()

                expect(aggregator.data.size).toBe(0);
                expect(aggregator.messages.length).toBe(0);

                scheduler.Start();

                expect(aggregator.data.size).toBe(10_000);
                expect(aggregator.messages.length).toBe(1);

                cache.AddOrUpdate(new Person("_New",1));

                expect(aggregator.data.size).toBe(10_001);
                expect(aggregator.messages.length).toBe(2);
            });       }
    }
});