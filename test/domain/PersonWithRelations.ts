import { IKey } from '../../src/cache/IKey';
import { Pet } from './Pet';

export class PersonWithRelations implements IKey<string> {
    public constructor(name: string, age: number, relations: PersonWithRelations[]) {
        this.name = name;
        this.age = age;
        this.keyValue = name;
        this.relations = relations;
        this.key = name;
    }

    public readonly name: string;

    public readonly age: number;

    public readonly keyValue: string;

    public readonly relations: PersonWithRelations[];
    public pet: Pet[] = [];

    public toString() {
        return `${this.name}. ${this.age}`;
    }

    public readonly key: string;
}
