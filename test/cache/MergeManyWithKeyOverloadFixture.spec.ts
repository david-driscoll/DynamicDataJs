import { Subject } from 'rxjs';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { mergeMany } from '../../src/cache/operators/mergeMany';

describe('MergeManyWithKeyOverloadFixture', () => {
    let _source: ISourceCache<ObjectWithObservable, number> & ISourceUpdater<ObjectWithObservable, number>;

    beforeEach(() => {
        _source = updateable(new SourceCache<ObjectWithObservable, number>(p => p.id));
    });

    afterEach(() => {
        _source.dispose();
    });

    it('InvocationOnlyWhenChildIsInvoked', () => {
        let invoked = false;
        const stream = _source
            .connect()
            .pipe(mergeMany((o, key) => o.observable))
            .subscribe(o => {
                invoked = true;
            });

        const item = new ObjectWithObservable(1);
        _source.addOrUpdate(item);

        expect(invoked).toBe(false);

        item.invokeObservable(true);
        expect(invoked).toBe(true);
        stream.unsubscribe();
    });

    it('RemovedItemWillNotCauseInvocation', () => {
        let invoked = false;
        const stream = _source
            .connect()
            .pipe(mergeMany((o, key) => o.observable))
            .subscribe(o => {
                invoked = true;
            });

        const item = new ObjectWithObservable(1);
        _source.addOrUpdate(item);
        _source.remove(item);
        expect(invoked).toBe(false);

        item.invokeObservable(true);
        expect(invoked).toBe(false);
        stream.unsubscribe();
    });

    it('EverythingIsUnsubscribedWhenStreamIsDisposed', () => {
        let invoked = false;
        const stream = _source
            .connect()
            .pipe(mergeMany((o, key) => o.observable))
            .subscribe(o => {
                invoked = true;
            });

        const item = new ObjectWithObservable(1);
        _source.addOrUpdate(item);

        stream.unsubscribe();

        item.invokeObservable(true);
        expect(invoked).toBe(false);
    });

    it('SingleItemCompleteWillNotMergedStream', () => {
        const completed = false;
        const stream = _source
            .connect()
            .pipe(mergeMany((o, key) => o.observable))
            .subscribe({
                complete() {},
            });

        const item = new ObjectWithObservable(1);
        _source.addOrUpdate(item);

        item.invokeObservable(true);
        item.completeObservable();

        stream.unsubscribe();

        expect(completed).toBe(false);
    });

    xit('SingleItemFailWillNotFailMergedStream', () => {
        let failed = false;
        const stream = _source
            .connect()
            .pipe(mergeMany((o, key) => o.observable))
            .subscribe({
                error(ex) {
                    failed = true;
                },
            });

        const item = new ObjectWithObservable(1);

        _source.addOrUpdate(item);

        item.failObservable(new Error('Test exception'));

        stream.unsubscribe();

        expect(failed).toBe(false);
    });

    class ObjectWithObservable {
        private readonly _changed = new Subject<boolean>();
        private _value = false;

        public constructor(id: number) {
            this.id = id;
        }

        public invokeObservable(value: boolean) {
            this._value = value;
            this._changed.next(value);
        }

        public completeObservable() {
            this._changed.complete();
        }

        public failObservable(ex: Error) {
            this._changed.error(ex);
        }

        public get observable() {
            return this._changed.asObservable();
        }

        public readonly id: number;
    }
});
