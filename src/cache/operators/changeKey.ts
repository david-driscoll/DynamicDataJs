import { OperatorFunction } from 'rxjs';
import { IChangeSet } from '../IChangeSet';
import { map } from 'rxjs/operators';
import { from as ixFrom } from 'ix/Ix.dom.iterable';
import { map as ixMap } from 'ix/Ix.dom.iterable.operators';
import { Change } from '../Change';
import { ChangeSet } from '../ChangeSet';
import { ChangeSetOperatorFunction } from '../ChangeSetOperatorFunction';

/**
 * Changes the primary key.
 * @typeparam TObject The type of the object.
 * @typeparam TSourceKey The type of the source key.
 * @typeparam TDestinationKey The type of the destination key.
 * @param selector The key selector eg. (item) => newKey;
 */
export function changeKey<TObject, TSourceKey, TDestinationKey>(selector: (value: TObject, sourceKey: TSourceKey) => TDestinationKey): ChangeSetOperatorFunction<TObject, TSourceKey, TObject, TDestinationKey> {
    return function changeKeyOperator(source) {
        return source.pipe(map(
            updates => {
                const changed = ixFrom(updates).pipe(ixMap(u => new Change(u.reason, selector(u.current, u.key), u.current, u.previous)));
                return new ChangeSet(changed);
            },
        ));
    };
}