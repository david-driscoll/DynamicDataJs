import { NotifyChanged, NotifyPropertyChanged } from '../../src/binding/NotifyPropertyChanged';
import { IKey } from '../../src/cache/IKey';

@NotifyPropertyChanged
export class PersonWithFriends implements IKey<string> {
    public constructor(name: string, age: number, friends: PersonWithFriends[] = []) {
        this.name = name;
        this.age = age;
        this.friends = friends;
        this.key = name;
    }

    public readonly name: string;
    @NotifyChanged()
    public age: number;

    @NotifyChanged()
    public friends: PersonWithFriends[];

    public toString() {
        return `${this.name}. ${this.age}`;
    }

    public readonly key: string;
}
