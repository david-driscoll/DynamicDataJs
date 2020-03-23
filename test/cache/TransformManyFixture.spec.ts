import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { PersonWithRelations } from '../domain/PersonWithRelations';
import { asAggregator, ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { transformMany } from '../../src/cache/operators/transformMany';
import { from } from 'ix/iterable';
import { expand } from 'ix/iterable/operators';
import { ignoreUpdateWhen } from '../../src/cache/operators/ignoreUpdateWhen';

describe('TransformManyFixture', () => {
    let _source: ISourceCache<PersonWithRelations, string> & ISourceUpdater<PersonWithRelations, string>;
    let _results: ChangeSetAggregator<PersonWithRelations, string>;

    beforeEach(() => {
        _source = updateable(new SourceCache<PersonWithRelations, string>(p => p.key));
        _results =
            asAggregator(
                _source.connect()
                    .pipe(
                        transformMany(
                            p => from(p.relations).pipe(expand(r => r.relations)),
                            p => p.name,
                        ),
                        ignoreUpdateWhen((current, previous) => current.name == previous.name),
                    ),
            );
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('RecursiveChildrenCanBeAdded', () => {
        const frientofchild1 = new PersonWithRelations('Friend1', 10);
        const child1 = new PersonWithRelations('Child1', 10, [frientofchild1]);
        const child2 = new PersonWithRelations('Child2', 8);
        const child3 = new PersonWithRelations('Child3', 8);
        const mother = new PersonWithRelations('Mother', 35, [child1, child2, child3]);
        //  const father = new PersonWithRelations("Father", 35, new[] {child1, child2, child3, mother});

        _source.addOrUpdate(mother);

        expect(_results.data.size).toBe(4);
        expect(_results.data.lookup('Child1')).toBeDefined();
        expect(_results.data.lookup('Child2')).toBeDefined();
        expect(_results.data.lookup('Child3')).toBeDefined();
        expect(_results.data.lookup('Friend1')).toBeDefined();
    });

    it('ChildrenAreRemovedWhenParentIsRemoved', () => {
        const frientofchild1 = new PersonWithRelations('Friend1', 10);
        const child1 = new PersonWithRelations('Child1', 10, [frientofchild1]);
        const child2 = new PersonWithRelations('Child2', 8);
        const child3 = new PersonWithRelations('Child3', 8);
        const mother = new PersonWithRelations('Mother', 35, [child1, child2, child3]);
        //  const father = new PersonWithRelations("Father", 35, new[] {child1, child2, child3, mother});

        _source.addOrUpdate(mother);
        _source.remove(mother);
        expect(_results.data.size).toBe(0);
    });
});
