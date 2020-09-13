import { BehaviorSubject } from 'rxjs';

export class PersonObs {
    private readonly _age: BehaviorSubject<number>;
    public readonly parentName: string;
    public readonly name: string;
    public readonly gender: string;

    public get key() {
        return this.name;
    }

    public constructor(name: string, age: number, gender: string = 'F', parentName?: string) {
        this.name = name;
        this._age = new BehaviorSubject<number>(age);
        this.gender = gender;
        this.parentName = parentName ?? '';
    }

    public age() {
        return this._age.asObservable();
    }

    public setAge(age: number) {
        this._age.next(age);
    }

    public static AgeEqualityComparer(x: PersonObs, y: PersonObs) {
        if (x === y) return true;
        if (x == null) return false;
        if (y == null) return false;
        return x.age == y.age;
    }

    public static NameAgeGenderEqualityComparer(x: PersonObs, y: PersonObs) {
        if (x === y) return true;
        if (x == null) return false;
        if (y == null) return false;
        return x.name === y.name && x._age.value === y._age.value && x.gender === y.gender;
    }

    public toString() {
        return `${this.name}. ${this._age.value}`;
    }
}
