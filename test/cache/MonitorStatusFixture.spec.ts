import { ConnectionStatus, statusMonitor } from '../../src/cache/operators/statusMonitor';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

describe('MonitorStatusFixture', () => {
    it('InitialiStatusIsLoadding', () => {
        let invoked = false;
        let status: ConnectionStatus = 'pending';
        const subscription = new Subject<number>()
            .pipe(statusMonitor())
            .subscribe(s => {
                invoked = true;
                status = s;
            });
        expect(invoked).toBe(true);
        expect(status).toBe('pending');
        subscription.unsubscribe();
    });

    it('SetToLoaded', () => {
        let invoked = false;
        let status: ConnectionStatus = 'pending';
        const subject = new Subject<number>();
        const subscription = subject
            .pipe(statusMonitor())
            .subscribe(s => {
                invoked = true;
                status = s;
            });

        subject.next(1);
        expect(invoked).toBe(true);
        expect(status).toBe('loaded');
        subscription.unsubscribe();
    });

    it('SetToError', () => {
        let invoked = false;
        let status: ConnectionStatus = 'pending';
        const subject = new Subject<number>();
        let exception: Error;

        const subscription = subject
            .pipe(statusMonitor())
            .subscribe(s => {
                invoked = true;
                status = s;
            }, ex => {
                exception = ex;
            });

        subject.error(new Error('Test'));
        subscription.unsubscribe();

        expect(invoked).toBe(true);
        expect(status).toBe('errored');
    });

    it('MultipleInvokesDoNotCallLoadedAgain', () => {
        let invoked = false;
        let invocations = 0;
        const subject = new Subject<number>();

        const subscription = subject
            .pipe(
                statusMonitor(),
                filter(status => status === 'loaded')
            )
            .subscribe(s => {
                invoked = true;
                invocations++;
            });

        subject.next(1);
        subject.next(1);
        subject.next(1);

        expect(invoked).toBe(true);
        ;
        expect(invocations).toBe(1);
        subscription.unsubscribe();
    });
});