import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { PersonEmpKey, PersonEmployment } from '../domain/PersonEmployment';
import { Person } from '../domain/Person';
import { count, every, from, range, toArray } from 'ix/iterable';
import { map, flatMap } from 'ix/iterable/operators';
import faker from 'faker';
import { PersonWithEmployment } from '../domain/PersonWithEmployment';
import { groupOn} from '../../src/cache/operators/groupOn';
import { distinctValues } from '../../src/cache/operators/distinctValues';
import { transform } from '../../src/cache/operators/transform';
import { asObservableCache } from '../../src/cache/operators/asObservableCache';
import { take, tap } from 'rxjs/operators';
import { notEmpty } from '../../src/cache/operators/notEmpty';
import { groupOnDistinct } from '../../src/cache/operators/groupOnDistinct';

describe('GroupFromDistinctFixture', () => {
    let _personCache: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    let _employmentCache: ISourceCache<PersonEmployment, PersonEmpKey> & ISourceUpdater<PersonEmployment, PersonEmpKey>;

    beforeEach(() => {
        _personCache = updateable(new SourceCache<Person, string>(p => p.key));
        _employmentCache = updateable(new SourceCache<PersonEmployment, PersonEmpKey>(e => e.key));
    });

    afterEach(() => {
        _personCache?.dispose();
        _employmentCache?.dispose();
    });

    fit('GroupFromDistinct', async () => {
        const numberOfPeople = 5;
        const companies = ['Company A', 'Company B', 'Company C'];
        //create 100 people
        const people = toArray(range(1, numberOfPeople).pipe(map(i => new Person(`Person${i}`, i))));

        //create 0-3 jobs for each person and select from companies
        const emphistory = toArray(range(1, numberOfPeople)
            .pipe(
                flatMap(i => {
                    const companiestogenrate = faker.random.number({ min: 1, max: 3 });
                    return range(0, companiestogenrate).pipe(map(c => new PersonEmployment(`Person${i}`, companies[c])));
                }),
            ));

        // Cache results
        const allpeopleWithEmpHistory = asObservableCache(_employmentCache.connect()
            .pipe(
                groupOnDistinct(z => z.name, _personCache.connect().pipe(
                    distinctValues(p => p.name)
                )),
                transform(x => new PersonWithEmployment(x)),
            ),
        );

        _personCache.addOrUpdateValues(people);
        _employmentCache.addOrUpdateValues(emphistory);

        expect(allpeopleWithEmpHistory.size).toBe(numberOfPeople);
        expect(count(from(allpeopleWithEmpHistory.values()).pipe(flatMap(d => d.employmentData.values())))).toBe(emphistory.length);

        //check grouped items have the same key as the parent
        from(allpeopleWithEmpHistory.values()).forEach
        (
            p => {
                expect(every(p.employmentData.values(), emph => emph.name == p.person)).toBe(true);
            },
        );

        _personCache.edit(updater => updater.removeKey('Person2'));
        expect(allpeopleWithEmpHistory.size).toBe(numberOfPeople - 1);
        _employmentCache.edit(updater => updater.removeValues(emphistory));
        allpeopleWithEmpHistory.dispose();
    });
});