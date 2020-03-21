import { range } from 'ix/iterable';
import { map } from 'ix/iterable/operators';
import faker from 'faker';
import { Person } from './Person';

export function randomPersonGenerator(number = 10000) {
    return range(0, number)
        .pipe(
            map(() => {
                const gender = faker.random.number(1);
                return new Person(
                    faker.name.firstName() + ' ' + faker.name.lastName(),
                    faker.random.number({ min: 1, max: 100 }),
                    gender ? 'F' : 'M',
                );
            }),
        );
}