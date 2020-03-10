import { ChangeAwareCache } from '../ChangeAwareCache';
import { IChangeSet } from '../IChangeSet';

export function filterChanges<TObject, TKey>(cache: ChangeAwareCache<TObject, TKey>,
                                             changes: IChangeSet<TObject, TKey>,
                                             predicate: (value: TObject) => boolean) {
    for (var change of changes) {
        var key = change.key;
        switch (change.reason) {
            case 'add': {
                var current = change.current;
                if (predicate(current)) {
                    cache.addOrUpdate(current, key);
                }
            }

                break;
            case 'update': {
                var current = change.current;
                if (predicate(current)) {
                    cache.addOrUpdate(current, key);
                } else {
                    cache.remove(key);
                }
            }

                break;
            case 'remove':
                cache.remove(key);
                break;
            case 'refresh': {
                var exisiting = cache.lookup(key);
                if (predicate(change.current)) {
                    if (!exisiting) {
                        cache.addOrUpdate(change.current, key);
                    } else {
                        cache.refresh(key);
                    }
                } else {
                    if (exisiting) {
                        cache.remove(key);
                    }
                }
            }

                break;
        }
    }
}