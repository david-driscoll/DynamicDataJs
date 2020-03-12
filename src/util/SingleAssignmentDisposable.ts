/**
 *
 */
import { Disposable, IDisposable, IDisposableOrSubscription, ISubscription } from './Disposable';

export class SingleAssignmentDisposable implements IDisposable {
    private _currentDisposable?: Disposable | null;
    private _isDisposed = false;

    public get isDisposed() {
        return this._isDisposed;
    }

    public get disposable() {
        return this._currentDisposable;
    }
    public set disposable(value: IDisposableOrSubscription | null | undefined) {
        if (this._currentDisposable) {
            throw new Error('Disposable has already been assigned');
        }
        if (!this.isDisposed) {
            this._currentDisposable = value ? new Disposable(value) : null;
        }
        if (this.isDisposed && value) {
            new Disposable(value).dispose();
        }
    }

    public unsubscribe(): void {
        this.dispose();
    }

    public dispose() {
        if (!this.isDisposed) {
            this._isDisposed = true;
            const old = this._currentDisposable;
            this._currentDisposable = null;
            if (old) {
                old.dispose();
            }
        }
    }
}
