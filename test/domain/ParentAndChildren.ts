import { Person } from './Person';

export class ParentAndChildren {
    public readonly parent: Person | undefined;
    public readonly parentId: string | undefined;
    public readonly children: Person[];

    public get count() {
        return this.children.length;
    }
    public constructor(parentId: string, parent: Person | undefined, children: Person[]);
    public constructor(parent: Person, children: Person[]);
    public constructor(parent: Person | string, parentOrChildren: Person[] | Person | undefined, children?: Person[]) {
        if (typeof parent === 'string') {
            this.parent = children as any;
            this.parentId = parent;
            this.children = children ?? [];
        } else {
            this.parent = parent;
            this.children = parentOrChildren as any;
        }
    }

    public toString() {
        return `Parent: ${this.parent}, (${this.count} children)`;
    }
}
