import { IChangeSet } from '../../src/cache/IChangeSet';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { deferUntilLoaded } from '../../src/cache/operators/deferUntilLoaded';
import { first } from 'ix/iterable';
import { skipInitial } from '../../src/cache/operators/skipInitial';
import { Person } from '../domain/Person';

describe('DeferAndSkipFixture', () => {
    it('DeferUntilLoadedDoesNothingUntilDataHasBeenReceived', () => {
        let updateReceived = false;
        let result: IChangeSet<Person, string> | undefined = undefined;

        const cache = updateable(new SourceCache<Person, string>(p => p.name));

        const deferStream = cache
            .connect()
            .pipe(deferUntilLoaded())
            .subscribe(changes => {
                updateReceived = true;
                result = changes;
            });

        const person = new Person('Test', 1);
        expect(updateReceived).toBe(false);
        cache.addOrUpdate(person);

        expect(updateReceived).toBe(true);
        expect(result!.adds).toBe(1);
        expect(first(result!)!.current).toBe(person);
        deferStream.unsubscribe();
    });

    it('SkipInitialDoesNotReturnTheFirstBatchOfData', () => {
        let updateReceived = false;

        const cache = updateable(new SourceCache<Person, string>(p => p.name));

        const deferStream = cache
            .connect()
            .pipe(skipInitial())
            .subscribe(changes => (updateReceived = true));

        expect(updateReceived).toBe(false);

        cache.addOrUpdate(new Person('P1', 1));

        expect(updateReceived).toBe(false);

        cache.addOrUpdate(new Person('P2', 2));
        expect(updateReceived).toBe(true);
        deferStream.unsubscribe();
    });
});
