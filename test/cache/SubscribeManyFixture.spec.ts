import construct = Reflect.construct;
import { Disposable } from '../../src/util';
import { SourceCache, updateable } from '../../src/cache/SourceCache';
import { ISourceUpdater } from '../../src/cache/ISourceUpdater';
import { ChangeSetAggregator } from '../util/aggregator';
import { ISourceCache } from '../../src/cache/ISourceCache';
import { subscribeMany } from '../../src/cache/operators/subscribeMany';
import { every, first, range } from 'ix/iterable';
import { map } from 'ix/iterable/operators';

describe('SubscribeManyFixture', function() {
    let _source: ISourceCache<SubscribeableObject, number> & ISourceUpdater<SubscribeableObject, number>;
    let _results: ChangeSetAggregator<SubscribeableObject, number>;

    beforeEach(() => {
        _source = updateable(new SourceCache<SubscribeableObject, number>((p => p.id)));
        _results = new ChangeSetAggregator<SubscribeableObject, number>(
            _source.connect()
                .pipe(subscribeMany(subscribeable => {
                    subscribeable.subscribe();
                    return Disposable.create(subscribeable);
                })));
    });

    afterEach(() => {
        _source.dispose();
        _results.dispose();
    });

    it('AddedItemWillbeSubscribed', () => {
        _source.addOrUpdate(new SubscribeableObject(1));

        expect(_results.messages.length).toBe(1);
        expect(_results.data.size).toBe(1);
        expect(first(_results.data.values())!.isSubscribed).toBe(true);
    });

    it('RemoveIsUnsubscribed', () => {
        _source.addOrUpdate(new SubscribeableObject(1));
        _source.removeKey(1);

        expect(_results.messages.length).toBe(2);
        expect(_results.data.size).toBe(0);
        expect(first(_results.messages[1])!.current.isSubscribed).toBe(false);
    });

    it('UpdateUnsubscribesPrevious', () => {
        _source.addOrUpdate(new SubscribeableObject(1));
        _source.addOrUpdate(new SubscribeableObject(1));

        expect(_results.messages.length).toBe(2);
        expect(_results.data.size).toBe(1);
        expect(first(_results.messages[1])!.current.isSubscribed).toBe(true);
        expect(first(_results.messages[1])!.previous!.isSubscribed).toBe(false);
    });

    it('EverythingIsUnsubscribedWhenStreamIsDisposed', () => {
        _source.addOrUpdateValues(range(1, 10).pipe(map(i => new SubscribeableObject(i))));
        _source.clear();

        expect(_results.messages.length).toBe(2);
        expect(every(_results.messages[1], d => !d.current.isSubscribed)).toBe(true);
    });

    class SubscribeableObject {
        public isSubscribed: boolean = false;
        public readonly id: number;

        public subscribe() {
            this.isSubscribed = true;
        }

        public unsubscribe() {
            this.isSubscribed = false;
        }

        public constructor(id: number) {
            this.id = id;
        }
    }
});
