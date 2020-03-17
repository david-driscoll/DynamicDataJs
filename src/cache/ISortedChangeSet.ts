import { SortedItems } from './SortedItems';
import { IChangeSet } from './IChangeSet';
export interface ISortedChangeSet<TObject, TKey> extends IChangeSet<TObject, TKey> {
    /**
     * All cached items in sort order
     */
    readonly sortedItems: SortedItems<TObject, TKey>;
}

export type Comparer<T> = (a: T, b: T) => -1 | 0 | 1;
export type SortReason = 'initialLoad' | 'comparerChanged' | 'dataChanged' | 'reorder' | 'reset';

function keyValueComparer<TObject, TKey>(comparer: Comparer<TObject> ) {

}
class KeyValueComparer<TObject, TKey> : IComparer<KeyValuePair<TKey, TObject>>
{
    private readonly IComparer<TObject> _comparer;

public KeyValueComparer(Comparer<TObject> comparer = null)
{
    _comparer = comparer;
}

public int Compare(KeyValuePair<TKey, TObject> x, KeyValuePair<TKey, TObject> y)
{
    if (_comparer != null)
    {
        int result = _comparer.Compare(x.Value, y.Value);

        if (result != 0)
        {
            return result;
        }
    }

    return x.Key.GetHashCode().CompareTo(y.Key.GetHashCode());
}
}