import { ISourceCache } from '../../src/cache/ISourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { Subject } from 'rxjs';
import { mergeMany } from '../../src/cache/operators/mergeMany';
import { mergeManyItems } from '../../src/cache/operators/mergeManyItems';

describe('MergeManyItemsFixture', function () {
    let _source: ISourceCache<ObjectWithObservable, number> & ISourceUpdater<ObjectWithObservable, number>;

    beforeEach(() => {
        _source = updateable(new SourceCache<ObjectWithObservable, number>(p => p.id));
    });

    afterEach(() => {
        _source.dispose();
    });

    class ObjectWithObservable {
        private readonly _changed = new Subject<boolean>();
        private _value: boolean = false;

        public constructor(id: number) {
            this.id = id;
        }

        public invokeObservable(value: boolean) {
            this._value = value;
            this._changed.next(value);
        }

        public observable = this._changed.asObservable();
        public id: number;
    }

    it('InvocationOnlyWhenChildIsInvoked', () => {
        let invoked = false;

        const stream = _source
            .connect()
            .pipe(mergeManyItems(x => x.observable))
            .subscribe(o => {
                invoked = true;
                expect(o.item.id == 1).toBe(true);
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
            .pipe(mergeManyItems(x => x.observable))
            .subscribe(o => {
                invoked = true;
                expect(o.item.id == 1).toBe(true);
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
            .pipe(mergeManyItems(x => x.observable))
            .subscribe(o => {
                invoked = true;
                expect(o.item.id == 1).toBe(true);
            });

        const item = new ObjectWithObservable(1);
        _source.addOrUpdate(item);

        stream.unsubscribe();

        item.invokeObservable(true);
        expect(invoked).toBe(false);
    });
});
