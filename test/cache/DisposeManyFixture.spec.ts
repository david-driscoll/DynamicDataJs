import { IDisposable } from '../../src/util';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { ChangeSetAggregator } from '../util/aggregator';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { disposeMany } from '../../src/cache/operators/disposeMany';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { every, first, range } from 'ix/iterable';
import { map } from 'ix/iterable/operators';
import { Unsubscribable } from 'rxjs';

describe('DisposeManyFixture', () => {
    describe('IDisposable', () => {
        let _source: ISourceCache<DisposableObject, number> & ISourceUpdater<DisposableObject, number>;
        let _results: ChangeSetAggregator<DisposableObject, number>;

        beforeEach(() => {
            _source = updateable(new SourceCache<DisposableObject, number>(p => p.id));
            _results = new ChangeSetAggregator<DisposableObject, number>(_source.connect().pipe(disposeMany()));
        });

        afterEach(() => {
            _source.dispose();
            _results.dispose();
        });

        it('AddWillNotCallDispose', () => {
            _source.addOrUpdate(new DisposableObject(1));

            expect(_results.messages.length).toBe(1);
            expect(_results.data.size).toBe(1);
            expect(first(_results.data.values())!.isDisposed).toBe(false);
        });

        it('RemoveWillCallDispose', () => {
            _source.addOrUpdate(new DisposableObject(1));
            _source.removeKey(1);

            expect(_results.messages.length).toBe(2);
            expect(_results.data.size).toBe(0);
            expect(first(_results.messages[1])!.current.isDisposed).toBe(true);
        });

        it('UpdateWillCallDispose', () => {
            _source.addOrUpdate(new DisposableObject(1));
            _source.addOrUpdate(new DisposableObject(1));

            expect(_results.messages.length).toBe(2);
            expect(_results.data.size).toBe(1);
            expect(first(_results.messages[1])!.current.isDisposed).toBe(false);
            expect(first(_results.messages[1])!.previous!.isDisposed).toBe(true);
        });

        it('EverythingIsDisposedWhenStreamIsDisposed', () => {
            _source.addOrUpdateValues(range(1, 10).pipe(map(i => new DisposableObject(i))));
            _source.clear();

            expect(_results.messages.length).toBe(2);
            expect(every(_results.messages[1], { predicate: d => d.current.isDisposed })).toBe(true);
        });
    });

    describe('Unsubscribable', () => {
        let _source: ISourceCache<UnsubscribableObject, number> & ISourceUpdater<UnsubscribableObject, number>;
        let _results: ChangeSetAggregator<UnsubscribableObject, number>;

        beforeEach(() => {
            _source = updateable(new SourceCache<UnsubscribableObject, number>(p => p.id));
            _results = new ChangeSetAggregator<UnsubscribableObject, number>(_source.connect().pipe(disposeMany()));
        });

        afterEach(() => {
            _source.dispose();
            _results.dispose();
        });

        it('AddWillNotCallDispose', () => {
            _source.addOrUpdate(new UnsubscribableObject(1));

            expect(_results.messages.length).toBe(1);
            expect(_results.data.size).toBe(1);
            expect(first(_results.data.values())!.isUnsubscribed).toBe(false);
        });

        it('RemoveWillCallDispose', () => {
            _source.addOrUpdate(new UnsubscribableObject(1));
            _source.removeKey(1);

            expect(_results.messages.length).toBe(2);
            expect(_results.data.size).toBe(0);
            expect(first(_results.messages[1])!.current.isUnsubscribed).toBe(true);
        });

        it('UpdateWillCallDispose', () => {
            _source.addOrUpdate(new UnsubscribableObject(1));
            _source.addOrUpdate(new UnsubscribableObject(1));

            expect(_results.messages.length).toBe(2);
            expect(_results.data.size).toBe(1);
            expect(first(_results.messages[1])!.current.isUnsubscribed).toBe(false);
            expect(first(_results.messages[1])!.previous!.isUnsubscribed).toBe(true);
        });

        it('EverythingIsDisposedWhenStreamIsDisposed', () => {
            _source.addOrUpdateValues(range(1, 10).pipe(map(i => new UnsubscribableObject(i))));
            _source.clear();

            expect(_results.messages.length).toBe(2);
            expect(every(_results.messages[0], { predicate: d => d.current.isUnsubscribed })).toBe(true);
        });
    });

    class DisposableObject implements IDisposable {
        private _isDisposed = false;
        public get isDisposed() {
            return this._isDisposed;
        }

        public get id() {
            return this._id;
        }

        public constructor(private _id: number) {}

        public dispose() {
            this._isDisposed = true;
        }
    }

    class UnsubscribableObject implements Unsubscribable {
        private _isUnsubscribed = false;
        public get isUnsubscribed() {
            return this._isUnsubscribed;
        }

        public get id() {
            return this._id;
        }

        public constructor(private _id: number) {}

        public unsubscribe() {
            this._isUnsubscribed = true;
        }
    }
});
