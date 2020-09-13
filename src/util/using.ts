import { canBeDisposed, Disposable, IDisposableOrSubscription, isDisposable } from './Disposable';

export function using<TDisposable extends IDisposableOrSubscription, TResult = void>(resource: TDisposable, func: (resource: TDisposable) => TResult): TResult {
    const disposable = canBeDisposed(resource) && !isDisposable(resource) ? Disposable.create(resource) : resource;
    let result: TResult | undefined;
    try {
        result = func(resource);
    } finally {
        disposable.dispose();
    }

    return result!;
}
