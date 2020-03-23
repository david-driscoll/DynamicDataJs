import { Observable, OperatorFunction, Subject } from 'rxjs';
import { distinctUntilChanged, startWith } from 'rxjs/operators';

export type ConnectionStatus = 'pending' | 'loaded' | 'errored' | 'completed';

/**
 * Monitors the status of a stream
 * @typeparam T
 */
export function statusMonitor<T>(): OperatorFunction<T, ConnectionStatus> {
    return function statusMonitorOperator(source) {
        return new Observable<ConnectionStatus>(observer => {
            const statusSubject = new Subject<ConnectionStatus>();
            let status: ConnectionStatus = 'pending';

            function error(ex: Error) {
                status = 'errored';
                statusSubject.next(status);
                observer.error(ex);
            }

            function completion() {
                if (status === 'errored') {
                    return;
                }

                status = 'completed';
                statusSubject.next(status);
            }

            function updated() {
                if (status !== 'pending') {
                    return;
                }

                status = 'loaded';
                statusSubject.next(status);
            }

            const monitor = source.subscribe(updated, error, completion);

            const subscriber = statusSubject
                .pipe(startWith(status), distinctUntilChanged())
                .subscribe(observer);

            return () => {
                statusSubject.complete();
                monitor.unsubscribe();
                subscriber.unsubscribe();
            };
        });
    };
}