import { BehaviorSubject } from 'rxjs';
import { IObservableCache } from '../../src/cache/IObservableCache';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { Node } from '../../src/cache/Node';
import { transformToTree } from '../../src/cache/operators/transformToTree';
import { asObservableCache } from '../../src/cache/operators/asObservableCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { first, from, toArray } from 'ix/iterable';
import { skip } from 'ix/iterable/operators';
import { tap } from 'rxjs/operators';

describe('TransformTreeFixture', () => {
    let _sourceCache: ISourceCache<EmployeeDto, number> & ISourceUpdater<EmployeeDto, number>;
    let _result: IObservableCache<Node<EmployeeDto, number>, number>;
    let _filter: BehaviorSubject<(node: Node<EmployeeDto, number>) => boolean>;
    let sourceId = 0;
    let cacheId = 0;

    beforeEach(() => {
        _sourceCache = updateable(new SourceCache<EmployeeDto, number>(e => e.id));
        _filter = new BehaviorSubject<(node: Node<EmployeeDto, number>) => boolean>(n => n.isRoot);
        _result = asObservableCache(_sourceCache.connect()
            .pipe(
                transformToTree(e => e.bossId, _filter),
            ),
        );
        cacheId = (_result as any).id;
    });

    afterEach(() => {
        _sourceCache.dispose();
        _result.dispose();
    });

    it('BuildTreeFromMixedData', () => {
        _sourceCache.addOrUpdateValues(createEmployees());
        expect(_result.size).toBe(2);

        const firstNode = first(_result.values())!;
        expect(firstNode.children.size).toBe(3);

        const secondNode = first(from(_result.values()).pipe(skip(1)))!;
        expect(secondNode.children.size).toBe(0);
    });

    it('UpdateAParentNode', () => {
        _sourceCache.addOrUpdateValues(createEmployees());

        const changed = new EmployeeDto(1, 0, 'Employee 1 (with name change)');
        _sourceCache.addOrUpdate(changed);
        expect(_result.size).toBe(2);

        const firstNode = first(_result.values())!;
        expect(firstNode.children.size).toBe(3);
        expect(firstNode.item.name).toBe(changed.name);
    });

    it('UpdateChildNode', () => {
        _sourceCache.addOrUpdateValues(createEmployees());

        const changed = new EmployeeDto(2, 1, 'Employee 2 (with name change)');
        _sourceCache.addOrUpdate(changed);
        expect(_result.size).toBe(2);

        const changedNode = first(first(_result.values())!.children.values())!;

        expect(changedNode.parent!.item.id).toBe(1);
        expect(changedNode.children.size).toBe(1);
        expect(changed.name).toBe(changed.name);
    });

    it('RemoveARootNodeWillPushOrphansUpTheHierachy', () => {
        _sourceCache.addOrUpdateValues(createEmployees());
        _sourceCache.removeKey(1);

        //we expect the original children nodes to be pushed up become new roots
        expect(_result.size).toBe(4);
    });

    fit('RemoveAChildNodeWillPushOrphansUpTheHierachy', () => {
        _sourceCache.addOrUpdateValues(createEmployees());
        _sourceCache.removeKey(4);

        //we expect the children of node 4  to be pushed up become new roots
        expect(_result.size).toBe(3);

        const thirdNode = first(from(_result.values()).pipe(skip(2)))!;
        expect(thirdNode.key).toBe(5);
    });

    it('AddMissingChild', () => {
        const boss = new EmployeeDto(2, 0, 'Boss');
        const minion = new EmployeeDto(1, 2, 'DogsBody');
        _sourceCache.addOrUpdate(boss);
        _sourceCache.addOrUpdate(minion);

        expect(_result.size).toBe(1);

        const firstNode = first(_result.values())!;
        expect(firstNode.item).toBe(boss);

        const childNode = first(firstNode.children.values())!;
        expect(childNode.item).toBe(minion);
    });
    it('AddMissingParent', () => {
        const emp10 = new EmployeeDto(10, 11, 'Employee10');
        const emp11 = new EmployeeDto(11, 0, 'Employee11');
        const emp12 = new EmployeeDto(12, 13, 'Employee12');
        const emp13 = new EmployeeDto(13, 11, 'Employee13');

        _sourceCache.addOrUpdate(emp10);
        _sourceCache.addOrUpdate(emp11);
        _sourceCache.addOrUpdate(emp12);
        _sourceCache.addOrUpdate(emp13);

        expect(_result.size).toBe(1);

        const emp11Node = _result.lookup(11);
        expect(emp11Node).toBeDefined();
        expect(emp11Node!.children.size).toBe(2);

        const emp10Node = emp11Node!.children.lookup(10);
        expect(emp10Node).toBeDefined();
        expect(emp10Node!.children.size).toBe(0);

        const emp13Node = emp11Node!.children.lookup(13);
        expect(emp13Node).toBeDefined();
        expect(emp13Node!.children.size).toBe(1);

        const emp12Node = emp13Node!.children.lookup(12);
        expect(emp12Node).toBeDefined();
        expect(emp12Node!.children.size).toBe(0);
    });

    it('ChangeParent', () => {
        _sourceCache.addOrUpdateValues(createEmployees());

        _sourceCache.addOrUpdate(new EmployeeDto(4, 1, 'Employee4'));

        //if this throws, then employee 4 is no a child of boss 1
        const emp4 = _result.lookup(1)!.children.lookup(4)!;

        //check boss is = 1
        expect(emp4.parent!.item.id).toBe(1);

        //lookup previous boss (emp 4 should no longet be a child)
        const emp3 = _result.lookup(1)!.children.lookup(3)!;

        //emp 4 must be removed from previous boss's child collection
        expect(emp3.children.lookup(4)).not.toBeDefined();
    });

    it('UseCustomFilter', () => {
        _sourceCache.addOrUpdateValues(createEmployees());

        expect(_result.size).toBe(2);

        _filter.next(node => true);
        expect(_result.size).toBe(8);

        _filter.next(node => node.depth === 3);
        expect(_result.size).toBe(1);

        _sourceCache.removeKey(5);
        expect(_result.size).toBe(0);

        _filter.next(node => node.isRoot);
        expect(_result.size).toBe(2);
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

    class EmployeeDto {
        public constructor(id: number, bossId = 0, name = '') {
            this.id = id;
            this.bossId = bossId;
            this.name = name;
        }

        public id: number;
        public bossId: number;
        public name: string;


        public toString() {
            return `Name: ${this.name}, Id: ${this.id}, BossId: ${this.bossId}`;
        }
    }

});