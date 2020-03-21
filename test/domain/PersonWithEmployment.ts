import { IObservableCache } from '../../src/cache/IObservableCache';
import { Group } from '../../src/cache/IGroupChangeSet';
import { PersonEmpKey, PersonEmployment } from './PersonEmployment';
import { IDisposable } from '../../src/util';

export class PersonWithEmployment implements IDisposable {
    private readonly _source: Group<PersonEmployment, PersonEmpKey, string>;

    public constructor(source: Group<PersonEmployment, PersonEmpKey, string>) {
        this._source = source;
        this.employmentData = source.cache;
    }

    public get person() {
        return this._source.key;
    }

    public readonly employmentData: IObservableCache<PersonEmployment, PersonEmpKey>;

    public get employmentCount() {
        return this.employmentData.size;
    }

    public dispose() {
        this.employmentData.dispose();
    }

    public toString() {
        return `Person: ${this.person}. Count ${this.employmentCount}`;
    }
}
