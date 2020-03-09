export class Lazy<T> {
    /**
     *
     */
    private _value?: T;
    private _isValueCreated = false;
    constructor(private _factory: () => T) {}

    public get value() {
        if (this._isValueCreated) {
            return this._value;
        }
        this._value = this._factory();
        this._isValueCreated = true;
        return this._value;
    }

    public get isValueCreated() {
        return this._isValueCreated;
    }
}
