import { NotifyPropertyChangedType } from '../../notify/notifyPropertyChangedSymbol';
import { ConnectableObservable, merge, MonoTypeOperatorFunction, Observable, SchedulerLike } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { bufferTime, filter, map, publish } from 'rxjs/operators';
import { mergeMany } from './mergeMany';
import { Change } from '../Change';
import { ChangeSet } from '../ChangeSet';
import { CompositeDisposable } from '../../util';

/**
 * Automatically refresh downstream operator. The refresh is triggered when the observable receives a notification
 * @param reevaluator An observable which acts on items within the collection and produces a value when the item should be refreshed
 * @param changeSetBuffer Batch up changes by specifying the buffer. This greatly increases performance when many elements require a refresh
 * @param scheduler The scheduler
 */
export function autoRefreshOnObservable<TObject, TKey>(
    reevaluator: (value: NotifyPropertyChangedType<TObject>, key: TKey) => Observable<unknown>,
    changeSetBuffer?: number,
    scheduler?: SchedulerLike,
): MonoTypeOperatorFunction<IChangeSet<NotifyPropertyChangedType<TObject>, TKey>> {
    return function autoRefreshOnObservableOperator(source) {
        return new Observable<IChangeSet<NotifyPropertyChangedType<TObject>, TKey>>(observer => {
            const shared: ConnectableObservable<IChangeSet<NotifyPropertyChangedType<TObject>, TKey>> = source.pipe(publish()) as any;

            //monitor each item observable and create change
            let changes = shared
                .pipe(mergeMany((t, k) =>
                    reevaluator(t, k)
                        .pipe(map(_ => new Change<NotifyPropertyChangedType<TObject>, TKey>('refresh', k, t))),
                ));

            //create a changeset, either buffered or one item at the time
            let refreshChanges: Observable<IChangeSet<NotifyPropertyChangedType<TObject>, TKey>>;
            if (changeSetBuffer === undefined) {
                refreshChanges = changes.pipe(map(c => new ChangeSet<NotifyPropertyChangedType<TObject>, TKey>([c])));
            } else {
                refreshChanges = changes
                    .pipe(
                        // TODO: There has be to be better way to buffer / window these changes in such a way where we don't always have a buffer opening and closing
                        bufferTime(changeSetBuffer, scheduler),
                        filter(z => z.some(x => true)),
                        map(items => new ChangeSet<NotifyPropertyChangedType<TObject>, TKey>(items)),
                    );
            }

            const publisher = merge(shared, refreshChanges)
                .subscribe(observer);

            return new CompositeDisposable(publisher, shared.connect());
        });
    };
}