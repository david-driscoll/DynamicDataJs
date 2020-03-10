export type ChangeReason = 'add' | 'update' | 'remove' | 'refresh' | 'moved';

export function isChangeReason(value: any) {
    return typeof value === 'string' && (value == 'add' || value == 'update' || value == 'remove' || value == 'refresh' || value == 'moved');
}
