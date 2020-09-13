import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { groupOn } from '../../src/cache/operators/groupOn';
import { first } from 'ix/iterable';
import { skip } from 'rxjs/operators';
import { Group } from '../../src/cache/IGroupChangeSet';
import { transform } from '../../src/cache/operators/transform';
import { bind } from '../../src/cache/operators/bind';
import { Person } from '../domain/Person';

describe('GroupFixture', () => {
    let _source: ISourceCache<Person, string> & ISourceUpdater<Person, string>;
    beforeEach(() => {
        _source = updateable(new SourceCache<Person, string>(p => p.name));
    });

    afterEach(() => {
        _source.dispose();
    });

    it('Add', () => {
        let called = false;
        const subscriber = _source
            .connect()
            .pipe(groupOn(z => z.age))
            .subscribe(updates => {
                expect(updates.size).toBe(1);
                expect(first(updates)!.reason).toBe('add');
                called = true;
            });
        _source.addOrUpdate(new Person('Person1', 20));

        subscriber.unsubscribe();
        expect(called).toBe(true);
    });

    it('UpdateNotPossible', () => {
        let called = false;
        const subscriber = _source
            .connect()
            .pipe(
                groupOn(z => z.age),
                skip(1),
            )
            .subscribe(updates => {
                called = true;
            });
        _source.addOrUpdate(new Person('Person1', 20));
        _source.addOrUpdate(new Person('Person1', 20));
        subscriber.unsubscribe();
        expect(called).toBe(false);
    });

    it('UpdateAnItemWillChangedThegroup', () => {
        let called = false;
        const subscriber = _source
            .connect()
            .pipe(groupOn(z => z.age))
            .subscribe(updates => {
                called = true;
            });
        _source.addOrUpdate(new Person('Person1', 20));
        _source.addOrUpdate(new Person('Person1', 21));
        subscriber.unsubscribe();
        expect(called).toBe(true);
    });

    it('Remove', () => {
        let called = false;
        const subscriber = _source
            .connect()
            .pipe(
                groupOn(z => z.age),
                skip(1),
            )
            .subscribe(updates => {
                expect(updates.size).toBe(1);
                expect(first(updates)?.reason).toBe('remove');
                called = true;
            });
        _source.addOrUpdate(new Person('Person1', 20));
        _source.remove(new Person('Person1', 20));
        subscriber.unsubscribe();
        expect(called).toBe(true);
    });

    it('FiresCompletedWhenDisposed', () => {
        let completed = false;
        const subscriber = _source
            .connect()
            .pipe(groupOn(z => z.age))
            .subscribe({
                complete() {
                    completed = true;
                },
            });
        _source.dispose();
        subscriber.unsubscribe();
        expect(completed).toBe(true);
    });

    it('FiresManyValueForBatchOfDifferentAdds', () => {
        let called = false;
        const subscriber = _source
            .connect()
            .pipe(groupOn(z => z.age))
            .subscribe(updates => {
                expect(updates.size).toBe(4);
                for (const update of updates) {
                    expect(update.reason).toBe('add');
                }
                called = true;
            });
        _source.edit(updater => {
            updater.addOrUpdate(new Person('Person1', 20));
            updater.addOrUpdate(new Person('Person2', 21));
            updater.addOrUpdate(new Person('Person3', 22));
            updater.addOrUpdate(new Person('Person4', 23));
        });

        subscriber.unsubscribe();
        expect(called).toBe(true);
    });

    it('FiresOnlyOnceForABatchOfUniqueValues', () => {
        let called = false;
        const subscriber = _source
            .connect()
            .pipe(groupOn(z => z.age))
            .subscribe(updates => {
                expect(updates.size).toBe(1);
                expect(first(updates)!.reason).toBe('add');
                called = true;
            });
        _source.edit(updater => {
            updater.addOrUpdate(new Person('Person1', 20));
            updater.addOrUpdate(new Person('Person2', 20));
            updater.addOrUpdate(new Person('Person3', 20));
            updater.addOrUpdate(new Person('Person4', 20));
        });

        subscriber.unsubscribe();
        expect(called).toBe(true);
    });

    it('FiresRemoveWhenEmptied', () => {
        let called = false;
        //skip first one a this is setting up the stream
        const subscriber = _source
            .connect()
            .pipe(
                groupOn(z => z.age),
                skip(1),
            )
            .subscribe(updates => {
                expect(updates.size).toBe(1);
                for (const update of updates) {
                    expect(update.reason).toBe('remove');
                }
                called = true;
            });
        const person = new Person('Person1', 20);

        _source.addOrUpdate(person);

        //remove
        _source.remove(person);

        subscriber.unsubscribe();
        expect(called).toBe(true);
    });

    it('ReceivesUpdateWhenFeederIsInvoked', () => {
        let called = false;
        const subscriber = _source
            .connect()
            .pipe(groupOn(z => z.age))
            .subscribe(updates => {
                called = true;
            });
        _source.addOrUpdate(new Person('Person1', 20));
        subscriber.unsubscribe();
        expect(called).toBe(true);
    });

    it('AddItemAfterUpdateItemProcessAdd', () => {
        const _entries: GroupViewModel[] = [];
        const subscriber = _source
            .connect()
            .pipe(
                groupOn(z => z.name[0]),
                transform(x => new GroupViewModel(x)),
                bind(_entries),
            )
            .subscribe();

        _source.edit(x => {
            x.addOrUpdate(new Person('Adam', 1));
        });

        const firstGroup = first(_entries)!;
        expect(firstGroup.entries.length).toBe(1);

        _source.edit(x => {
            x.addOrUpdate(new Person('Adam', 3)); // update
            x.addOrUpdate(new Person('Alfred', 1)); // add
        });

        expect(firstGroup.entries.length).toBe(2);

        subscriber.unsubscribe();
    });

    it('UpdateItemAfterAddItemProcessAdd', () => {
        const _entries: GroupViewModel[] = [];
        const subscriber = _source
            .connect()
            .pipe(
                groupOn(z => z.name[0]),
                transform(x => new GroupViewModel(x)),
                bind(_entries),
            )
            .subscribe();

        _source.edit(x => {
            x.addOrUpdate(new Person('Adam', 1));
        });

        const firstGroup = first(_entries)!;
        expect(firstGroup.entries.length).toBe(1);

        _source.edit(x => {
            x.addOrUpdate(new Person('Alfred', 1)); // add
            x.addOrUpdate(new Person('Adam', 3)); // update
        });

        expect(firstGroup.entries.length).toBe(2);

        subscriber.unsubscribe();
    });
});

class GroupViewModel {
    public readonly entries: GroupEntryViewModel[] = [];

    public constructor(person: Group<Person, string, string>) {
        person.cache
            .connect()
            .pipe(
                transform(x => new GroupEntryViewModel(x)),
                bind(this.entries),
            )
            .subscribe();
    }
}

class GroupEntryViewModel {
    constructor(public readonly person: Person) {}
}
