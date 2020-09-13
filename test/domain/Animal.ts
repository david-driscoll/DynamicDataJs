import { Observable } from 'rxjs';
import { NotifyChanged, NotifyPropertyChanged } from '../../src/binding/NotifyPropertyChanged';
import { notifyPropertyChangedSymbol } from '../../src/notify/notifyPropertyChangedSymbol';

export enum AnimalFamily {
    Mammal,
    Reptile,
    Fish,
    Amphibian,
    Bird,
}

@NotifyPropertyChanged
export class Animal {
    @NotifyChanged()
    public includeInResults: boolean;

    public constructor(public readonly name: string, public readonly type: string, public readonly family: AnimalFamily) {
        this.includeInResults = false;
    }
}
