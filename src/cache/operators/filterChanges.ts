import { ChangeAwareCache } from '../ChangeAwareCache';
import { IChangeSet } from '../IChangeSet';

export function filterChanges<TObject, TKey>(cache: ChangeAwareCache<TObject, TKey>,
                                             changes: IChangeSet<TObject, TKey>,
                                             predicate: (value: TObject) => boolean) {
    for (const change of changes) {
        const key = change.key;
        switch (change.reason) {
            case 'add': {
                const current = change.current;
                if (predicate(current)) {
                    cache.addOrUpdate(current, key);
                }
            }

                break;
            case 'update': {
                const current = change.current;
                if (predicate(current)) {
                    cache.addOrUpdate(current, key);
                } else {
                    cache.removeKey(key);
                }
            }

                break;
            case 'remove':
                cache.removeKey(key);
                break;
            case 'refresh': {
                const exisiting = cache.lookup(key);
                if (predicate(change.current)) {
                    if (!exisiting) {
                        cache.addOrUpdate(change.current, key);
                    } else {
                        cache.refreshKey(key);
                    }
                } else {
                    if (exisiting) {
                        cache.removeKey(key);
                    }
                }
            }

                break;
        }
    }
}