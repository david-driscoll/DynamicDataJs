import { IObservableCache } from '../../src/cache/IObservableCache';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { Node } from '../../src/cache/Node';
import { autoRefresh } from '../../src/cache/operators/autoRefresh';
import { transformToTree } from '../../src/cache/operators/transformToTree';
import { asObservableCache } from '../../src/cache/operators/asObservableCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { NotifyChanged, NotifyPropertyChanged } from '../../src/binding/NotifyPropertyChanged';
import { NotifyPropertyChangedType } from '../../src/notify/notifyPropertyChangedSymbol';

describe('TransformTreeWithRefreshFixture', () => {
    let _sourceCache: ISourceCache<EmployeeDto, number> & ISourceUpdater<EmployeeDto, number>;
    let _result: IObservableCache<Node<NotifyPropertyChangedType<EmployeeDto>, number>, number>;

    beforeEach(() => {
        _sourceCache = updateable(new SourceCache<EmployeeDto, number>(e => e.id));
        _result = asObservableCache(_sourceCache.connect()
            .pipe(
                autoRefresh(),
                transformToTree(e => e.bossId),
            ));
        _sourceCache.addOrUpdateValues(createEmployees());
    });

    afterEach(() => {
        _sourceCache.dispose();
        _result.dispose();
    });

    it('UpdateTreeWhenParentIdOfRootItemChangedToExistingId', () => {
        _sourceCache.lookup(1)!.bossId = 7;

        // node 1 added to node 7 children cache
        const node1 = _result.lookup(7)!.children.lookup(1);
        expect(node1).toBeDefined();
        expect(node1!.isRoot).toBe(false);

        // node 1 removed from root
        expect(_result.lookup(1)).not.toBeDefined();
    });

    it('UpdateTreeWhenParentIdOfRootItemChangedToNonExistingId', () => {
        _sourceCache.lookup(1)!.bossId = 25;

        // node 1 added to node 7 children cache
        const node1 = _result.lookup(1);
        expect(node1).toBeDefined();
        expect(node1!.isRoot).toBe(true);
    });

    it('UpdateTreeWhenParentIdOfNonRootItemChangedToExistingId', () => {
        _sourceCache.lookup(2)!.bossId = 3;

        // node 2 added to node 3 children cache
        const node2 = _result.lookup(1)!.children.lookup(3)!.children.lookup(2);
        expect(node2).toBeDefined();
        expect(node2!.isRoot).toBe(false);

        // node 2 removed from node 1 children cache
        expect(_result.lookup(1)!.children.lookup(2)!).not.toBeDefined();
    });

    it('UpdateTreeWhenParentIdOfNonRootItemChangedToNonExistingId', () => {
        _sourceCache.lookup(2)!.bossId = 25;

        // node 2 added to root
        const node2 = _result.lookup(2);
        expect(node2).toBeDefined();
        expect(node2!.isRoot).toBe(true);

        // node 2 removed from node 1 children cache
        expect(_result.lookup(1)!.children.lookup(2)!).not.toBeDefined();
    });

    it('DoNotUpdateTreeWhenParentIdNotChanged', () => {
        _sourceCache.lookup(1)!.name = 'Employee11';
        _sourceCache.lookup(2)!.name = 'Employee22';

        const node1 = _result.lookup(1);
        expect(node1).toBeDefined();
        expect((node1!.parent!)).not.toBeDefined();
        const node2 = node1!.children.lookup(2);
        expect(node2).toBeDefined();
        expect(node2!.parent).toBeDefined();
        expect(node2!.parent!.key).toBe(1);
    });


    function* createEmployees() {
        yield new EmployeeDto(1, 0, 'Employee1');
        yield new EmployeeDto(2, 1, 'Employee2');
        yield new EmployeeDto(3, 1, 'Employee3');
        yield new EmployeeDto(4, 3, 'Employee4');
        yield new EmployeeDto(5, 4, 'Employee5');
        yield new EmployeeDto(6, 2, 'Employee6');
        yield new EmployeeDto(7, 0, 'Employee7');
        yield new EmployeeDto(8, 1, 'Employee8');
    }

    @NotifyPropertyChanged
    class EmployeeDto {
        public constructor(id: number, bossId = 0, name = '') {
            this.id = id;
            this.bossId = bossId;
            this.name = name;
        }

        public id: number;
        @NotifyChanged()
        public bossId: number;
        @NotifyChanged()
        public name: string;

        public toString() {
            return `Name: ${this.name}, Id: ${this.id}, BossId: ${this.bossId}`;
        }
    }
});