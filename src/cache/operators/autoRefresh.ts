import { NotifyPropertyChanged } from '../../notify/notifyPropertyChangedSymbol';
import { MonoTypeOperatorFunction, SchedulerLike } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { autoRefreshOnObservable } from './autoRefreshOnObservable';
import { whenAnyPropertyChanged } from './whenAnyPropertyChanged';
import { throttleTime } from 'rxjs/operators';

/**
 * Automatically refresh downstream operators when any properties change.
 * @param changeSetBuffer Batch up changes by specifying the buffer. This greatly increases performance when many elements have sucessive property changes
 * @param propertyChangeThrottle When observing on multiple property changes, apply a throttle to prevent excessive refesh invocations
 * @param scheduler The scheduler
 */
export function autoRefresh<TObject extends NotifyPropertyChanged, TKey>(
    changeSetBuffer?: number,
    propertyChangeThrottle?: number,
    scheduler?: SchedulerLike,
): MonoTypeOperatorFunction<IChangeSet<NotifyPropertyChanged<TObject>, TKey>>;
/**
 * Automatically refresh downstream operators when any properties change.
 * @param key the property to watch
 * @param changeSetBuffer Batch up changes by specifying the buffer. This greatly increases performance when many elements have sucessive property changes
 * @param propertyChangeThrottle When observing on multiple property changes, apply a throttle to prevent excessive refesh invocations
 * @param scheduler The scheduler
 */
export function autoRefresh<TObject extends NotifyPropertyChanged, TKey>(
    key: keyof TObject,
    changeSetBuffer?: number,
    propertyChangeThrottle?: number,
    scheduler?: SchedulerLike,
): MonoTypeOperatorFunction<IChangeSet<NotifyPropertyChanged<TObject>, TKey>>;
export function autoRefresh<TObject extends NotifyPropertyChanged, TKey>(
    key?: number | keyof TObject,
    changeSetBuffer?: number,
    propertyChangeThrottle?: number | SchedulerLike,
    scheduler?: SchedulerLike,
): MonoTypeOperatorFunction<IChangeSet<NotifyPropertyChanged<TObject>, TKey>> {
    let props: string[] = [];
    if (typeof key === 'string' || typeof key === 'symbol') {
        props.push(key as any);
    } else {
        scheduler = propertyChangeThrottle as any;
        propertyChangeThrottle = changeSetBuffer as any;
        changeSetBuffer = key as any;
    }

    return function autoRefreshOperator(source) {
        return source.pipe(
            autoRefreshOnObservable<TObject, TKey>((t, v) => {
                if (propertyChangeThrottle) {
                    return whenAnyPropertyChanged(t, ...props)
                        .pipe(throttleTime(propertyChangeThrottle as number, scheduler));
                } else {
                    return whenAnyPropertyChanged(t, ...props);
                }
            }, changeSetBuffer as number | undefined, scheduler),
        );
    };
}