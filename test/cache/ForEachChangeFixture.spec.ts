import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { Change } from '../../src/cache/Change';
import { forEachChange } from '../../src/cache/operators/forEachChange';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { range } from 'ix/iterable';
import { map } from 'ix/iterable/operators';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { randomPersonGenerator } from '../domain/RandomPersonGenerator';
import { Person } from '../domain/Person';

describe('ForEachChangeFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
    });

    afterEach(() => {
        _source.dispose();
    });

    it('Test', () => {
        const messages: Change<Person, string>[] = [];
        const messageWriter = _source
            .connect()
            .pipe(
                forEachChange(x => messages.push(x)),
            )
            .subscribe();

        _source.addOrUpdateValues(randomPersonGenerator(100));
        messageWriter.unsubscribe();

        expect(messages.length).toBe(100);
    });
});
