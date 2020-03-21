import { Person } from './Person';

export class PersonWithGender {
    public static create(person: Person, gender: string) {
        return new PersonWithGender(person.name, person.age, gender);
    }

    public readonly name: string;
    public readonly age: number;
    public readonly gender: string;

    public constructor(name: string, age: number, gender: string) {
        this.name = name;
        this.age = age;
        this.gender = gender;
    }

    public toString() {
        return `${this.name}. ${this.age} (${this.gender})`;
    }
}
