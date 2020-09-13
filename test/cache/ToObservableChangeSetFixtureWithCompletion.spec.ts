import { Subject, Subscription } from 'rxjs';
import { Person } from '../domain/Person';
import { IDisposable } from '../../src/util';
import { toObservableChangeSet } from '../../src/cache/operators/toObservableChangeSet';
import { clone } from '../../src/cache/operators/clone';
import { map } from 'rxjs/operators';

describe('ToObservableChangeSetFixtureWithCompletion', () => {
    let _observable: Subject<Person>;
    let _disposable: Subscription;
    let _target: Person[];
    let _hasCompleted = false;

    beforeEach(() => {
        _observable = new Subject<Person>();

        _target = [];

        _disposable = toObservableChangeSet(_observable.pipe(map(z => [z])), p => p.key)
            .pipe(clone(_target))
            .subscribe({
                complete() {
                    _hasCompleted = true;
                },
            });
    });

    afterEach(() => {
        _disposable.unsubscribe();
    });

    it('ShouldReceiveUpdatesThenComplete', () => {
        _observable.next(new Person('One', 1));
        _observable.next(new Person('Two', 2));

        expect(_target.length).toBe(2);

        _observable.complete();
        expect(_hasCompleted).toBe(true);

        _observable.next(new Person('Three', 3));
        expect(_target.length).toBe(2);
    });
});
