import { Observable, OperatorFunction, queueScheduler, SchedulerLike } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { NotifyPropertyChangedType } from '../../notify/notifyPropertyChangedSymbol';
import { publish, throttleTime } from 'rxjs/operators';
import { whenValueChanged } from './whenValueChanged';
import { groupOn } from './groupOn';
import { Group } from '../IGroupChangeSet';
import { ChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Groups the source using the property specified by the property selector. Groups are re-applied when the property value changed.
 * When there are likely to be a large number of group property changes specify a throttle to improve performance
 * @typeparam TObject The type of the object.
 * @typeparam TKey The type of the key.
 * @typeparam TGroupKey The type of the group key.
 * @param key The key to watch
 * @param propertyChangedThrottle
 * @param scheduler The scheduler.
 */
export function groupOnProperty<TObject, TKey, TGroupKey, TProperty extends keyof TObject>(
    key: TProperty,
    propertyChangedThrottle?: number,
    scheduler: SchedulerLike = queueScheduler,
): ChangeSetOperatorFunction<TObject, TKey, Group<NotifyPropertyChangedType<TObject>, TKey, TObject[TProperty]>, TObject[TProperty]> {
    return function groupOnKeyOperator(source) {
        return source
            .pipe(publish(shared => {
                // Monitor explicit property changes
                let regrouper = shared.pipe(whenValueChanged(key, false));

                //add a throttle if specified
                if (propertyChangedThrottle) {
                    regrouper = regrouper
                        .pipe(throttleTime(propertyChangedThrottle, scheduler ?? queueScheduler));
                }

                // Use property changes as a trigger to re-evaluate Grouping
                return shared.pipe(groupOn(x => x[key], regrouper)) as any as Observable<IChangeSet<Group<NotifyPropertyChangedType<TObject>, TKey, TObject[TProperty]>, TObject[TProperty]>>;
            }));
    };
}
