import { NotifyChanged, NotifyPropertyChanged } from '../../src/binding/NotifyPropertyChanged';
import { notifyPropertyChangedSymbol } from '../../src/notify/notifyPropertyChangedSymbol';

@NotifyPropertyChanged
export class Person {
    public readonly parentName: string;
    public readonly name: string;
    public readonly gender: string;

    public get key() {
        return this.name;
    }

    public constructor(name: string, age: number, gender: string = 'F', parentName?: string) {
        this.name = name;
        this.age = age;
        this.gender = gender;
        this.parentName = parentName ?? '';
    }

    @NotifyChanged()
    public age: number;

    public static AgeEqualityComparer(x: Person, y: Person) {
        if (x === y) return true;
        if (x == null) return false;
        if (y == null) return false;
        return x.age == y.age;
    }

    public static NameAgeGenderEqualityComparer(x: Person, y: Person) {
        if (x === y) return true;
        if (x == null) return false;
        if (y == null) return false;
        return x.name === y.name && x.age === y.age && x.gender === y.gender;
    }

    public toString() {
        return `${this.name}. ${this.age}`;
    }
}

const person = new Person('ad', 123);
person[notifyPropertyChangedSymbol];
