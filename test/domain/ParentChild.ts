import { Person } from './Person';

export class ParentChild {
    public child: Person;
    public parent: Person;

    public constructor(child: Person, parent: Person) {
        this.child = child;
        this.parent = parent;
    }
}
