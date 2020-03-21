import { Person } from './Person';

export class PersonWithChildren {

    public constructor(name: string, age: number, relations: Person[] = []) {
        this.name = name;
        this.age = age;
        this.keyValue = name;
        this.relations = relations;
        this.key = name;
    }

    public readonly keyValue: string;
    public readonly key: string;
    public readonly name: string;
    public readonly age: number;
    public readonly relations: Person[];

    public toString() {
        return `${this.name}. ${this.age}`;
    }
}