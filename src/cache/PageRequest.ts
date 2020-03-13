export class PageRequest {
    public constructor(public readonly page = 1, public readonly size = 25) {}
    public static readonly default = new PageRequest();
    public static readonly empty = new PageRequest(0, 0);
}
