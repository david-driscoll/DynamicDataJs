import { ISourceCache } from '../../src/cache/ISourceCache';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { Observable, Subject } from 'rxjs';
import { trueForAll } from '../../src/cache/operators/trueForAll';
import { startWith } from 'rxjs/operators';

describe('TrueForAllFixture', () => {
    let _source: ISourceCache<ObjectWithObservable, number> & ISourceUpdater<ObjectWithObservable, number>;
    let _observable: Observable<boolean>;

    beforeEach(() => {
        _source = updateable(new SourceCache<ObjectWithObservable, number>(p => p.id));
        _observable = _source.connect().pipe(
            trueForAll(
                o => o.observable.pipe(startWith(o.value)),
                (object, invoked) => invoked,
            ),
        );
    });

    afterEach(() => {
        _source.dispose();
    });

    it('InitialItemReturnsFalseWhenObservableHasNoValue', () => {
        let valuereturned: boolean | null = null;
        const subscribed = _observable.subscribe(result => {
            valuereturned = result;
        });

        const item = new ObjectWithObservable(1);
        _source.addOrUpdate(item);

        expect(valuereturned).toBeDefined();
        expect(valuereturned).toBe(false);

        subscribed.unsubscribe();
    });

    it('InlineObservableChangeProducesResult', () => {
        let valuereturned: boolean | null = null;
        const subscribed = _observable.subscribe(result => {
            valuereturned = result;
        });

        const item = new ObjectWithObservable(1);
        item.InvokeObservable(true);
        _source.addOrUpdate(item);

        expect(valuereturned).toBe(true);
        subscribed.unsubscribe();
    });

    it('MultipleValuesReturnTrue', () => {
        let valuereturned: boolean | null = null;
        const subscribed = _observable.subscribe(result => {
            valuereturned = result;
        });

        const item1 = new ObjectWithObservable(1);
        const item2 = new ObjectWithObservable(2);
        const item3 = new ObjectWithObservable(3);
        _source.addOrUpdate(item1);
        _source.addOrUpdate(item2);
        _source.addOrUpdate(item3);
        expect(valuereturned).toBe(false);

        item1.InvokeObservable(true);
        item2.InvokeObservable(true);
        item3.InvokeObservable(true);
        expect(valuereturned).toBe(true);

        subscribed.unsubscribe();
    });

    class ObjectWithObservable {
        private _id: number = 0;
        private readonly _changed = new Subject<boolean>();
        private _value = false;

        public constructor(id: number) {
            this._id = id;
        }

        public InvokeObservable(value: boolean) {
            this._value = value;
            this._changed.next(value);
        }

        public get observable() {
            return this._changed.asObservable();
        }

        public get value() {
            return this._value;
        }

        public get id() {
            return this._id;
        }
    }
});
