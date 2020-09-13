import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { PersonWithChildren } from '../domain/PersonWithChildren';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { Person } from '../domain/Person';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { transformMany } from '../../src/cache/operators/transformMany';

describe('TransformManySimpleFixture', function () {
    let _source: ISourceCache<PersonWithChildren, string> & ISourceUpdater<PersonWithChildren, string>;
    let _results: ChangeSetAggregator<Person, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<PersonWithChildren, string>(p => p.key));

        _results = asAggregator(
            _source.connect().pipe(
                transformMany(
                    p => p.relations,
                    p => p.name,
                ),
            ),
        );
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('Adds', () => {
        const parent = new PersonWithChildren('parent', 50, [new Person('Child1', 1), new Person('Child2', 2), new Person('Child3', 3)]);
        _source.addOrUpdate(parent);
        expect(_results.data.size).toBe(3);

        expect(_results.data.lookup('Child1')).toBeDefined();
        expect(_results.data.lookup('Child2')).toBeDefined();
        expect(_results.data.lookup('Child3')).toBeDefined();
    });

    it('remove', () => {
        const parent = new PersonWithChildren('parent', 50, [new Person('Child1', 1), new Person('Child2', 2), new Person('Child3', 3)]);
        _source.addOrUpdate(parent);
        _source.remove(parent);
        expect(_results.data.size).toBe(0);
    });

    it('removewithIncompleteChildren', () => {
        const parent1 = new PersonWithChildren('parent', 50, [new Person('Child1', 1), new Person('Child2', 2), new Person('Child3', 3)]);
        _source.addOrUpdate(parent1);

        const parent2 = new PersonWithChildren('parent', 50, [new Person('Child1', 1), new Person('Child3', 3)]);
        _source.remove(parent2);
        expect(_results.data.size).toBe(0);
    });

    it('UpdateWithLessChildren', () => {
        const parent1 = new PersonWithChildren('parent', 50, [new Person('Child1', 1), new Person('Child2', 2), new Person('Child3', 3)]);
        _source.addOrUpdate(parent1);

        const parent2 = new PersonWithChildren('parent', 50, [new Person('Child1', 1), new Person('Child3', 3)]);
        _source.addOrUpdate(parent2);
        expect(_results.data.size).toBe(2);
        expect(_results.data.lookup('Child1')).toBeDefined();
        expect(_results.data.lookup('Child3')).toBeDefined();
    });

    it('UpdateWithMultipleChanges', () => {
        const parent1 = new PersonWithChildren('parent', 50, [new Person('Child1', 1), new Person('Child2', 2), new Person('Child3', 3)]);
        _source.addOrUpdate(parent1);

        const parent2 = new PersonWithChildren('parent', 50, [new Person('Child1', 1), new Person('Child3', 3), new Person('Child5', 3)]);
        _source.addOrUpdate(parent2);
        expect(_results.data.size).toBe(3);
        expect(_results.data.lookup('Child1')).toBeDefined();
        expect(_results.data.lookup('Child3')).toBeDefined();
        expect(_results.data.lookup('Child5')).toBeDefined();
    });
});
