import { IDisposable } from '../util/Disposable';
import { IConnectableCache } from './IConnectableCache';
import { IQuery } from './IQuery';

/**
 * A cache for observing and querying in memory data. With additional data access operators
 * @typeparam TObject The type of the object
 * @typeparam TKey The type of the key
 */
export interface IObservableCache<TObject, TKey> extends IConnectableCache<TObject, TKey>, IQuery<TObject, TKey>, IDisposable {
}


