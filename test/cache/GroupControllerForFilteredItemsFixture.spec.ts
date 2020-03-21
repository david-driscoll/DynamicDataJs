import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { Subject } from 'rxjs';
import { IObservableCache } from '../../src/cache/IObservableCache';
import { Group } from '../../src/cache/IGroupChangeSet';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { groupOn } from '../../src/cache/operators/groupOn';
import { asObservableCache } from '../../src/cache/operators/asObservableCache';
import { count, from } from 'ix/iterable';
import { map, filter, concatAll, flatMap } from 'ix/iterable/operators';
import { Person } from '../domain/Person';

describe('GroupControllerForFilteredItemsFixture', function() {

    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _refresher: Subject<unknown>;
    let _grouped: IObservableCache<Group<Person, string, AgeBracket>, AgeBracket>;
    const _grouper = (p: Person) => {
        if (p.age <= 19) {
            return AgeBracket.Under20;
        }

        return p.age <= 60 ? AgeBracket.Adult : AgeBracket.Pensioner;
    };

    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
        _refresher = new Subject<unknown>();
        _grouped = asObservableCache(_source.connect(p => _grouper(p) !== AgeBracket.Pensioner)
            .pipe(groupOn(_grouper, _refresher)),
        );
    });

    afterEach(() => {
        _source?.dispose();
        _grouped?.dispose();
    });

    it('RegroupRecaluatesGroupings', () => {
        const p1 = new Person('P1', 10);
        const p2 = new Person('P2', 15);
        const p3 = new Person('P3', 30);
        const p4 = new Person('P4', 70);
        _source.addOrUpdateValues([p1, p2, p3, p4]);

        expect(IsContainedIn('P1', AgeBracket.Under20)).toBe(true);
        expect(IsContainedIn('P2', AgeBracket.Under20)).toBe(true);
        expect(IsContainedIn('P3', AgeBracket.Adult)).toBe(true);
        expect(IsContainedIn('P4', AgeBracket.Pensioner)).toBe(false);

        p1.age = 60;
        p2.age = 80;
        p3.age = 15;
        p4.age = 30;

        _refresher.next(undefined);

        expect(IsContainedIn('P1', AgeBracket.Adult)).toBe(true);
        expect(IsContainedIn('P3', AgeBracket.Under20)).toBe(true);

        expect(IsContainedOnlyInOneGroup('P1')).toBe(true);
        expect(IsContainedOnlyInOneGroup('P2')).toBe(true);
    });
    it('RegroupRecaluatesGroupings2', () => {
        const p1 = new Person('P1', 10);
        const p2 = new Person('P2', 15);
        const p3 = new Person('P3', 30);
        const p4 = new Person('P4', 70);
        _source.addOrUpdateValues([p1, p2, p3, p4]);

        expect(IsContainedIn('P1', AgeBracket.Under20)).toBe(true);
        expect(IsContainedIn('P2', AgeBracket.Under20)).toBe(true);
        expect(IsContainedIn('P3', AgeBracket.Adult)).toBe(true);
        expect(IsContainedIn('P4', AgeBracket.Pensioner)).toBe(false);

        p1.age = 60;
        p2.age = 80;
        p3.age = 15;
        p4.age = 30;

        _source.refreshValues([p1, p2, p3, p4]);

        expect(IsContainedIn('P1', AgeBracket.Adult)).toBe(true);
        expect(IsContainedIn('P2', AgeBracket.Pensioner)).toBe(false);
        expect(IsContainedIn('P3', AgeBracket.Under20)).toBe(true);
        expect(IsContainedIn('P4', AgeBracket.Adult)).toBe(true);

        expect(IsContainedOnlyInOneGroup('P1')).toBe(true);
        expect(IsNotContainedAnyWhere('P2')).toBe(true);
        expect(IsContainedOnlyInOneGroup('P3')).toBe(true);
        expect(IsContainedOnlyInOneGroup('P4')).toBe(true);
    });

    function IsContainedIn(name: string, bracket: AgeBracket) {
        const group = _grouped.lookup(bracket);
        if (group === undefined) {
            return false;
        }

        return group.cache.lookup(name) !== undefined;
    }

    function IsContainedOnlyInOneGroup(name: string) {
        const items = from(_grouped.values())
            .pipe(
                flatMap(g => from(g.cache.values())),
                filter(z => z.name === name),
            );
        const cnt = count(items);
        return cnt === 1;
    }

    function IsNotContainedAnyWhere(name: string) {
        const items = from(_grouped.values())
            .pipe(
                flatMap(g => from(g.cache.values())),
                filter(z => z.name === name),
            );
        const cnt = count(items);
        return cnt === 0;
    }
});

enum AgeBracket {
    Under20,
    Adult,
    Pensioner
}
