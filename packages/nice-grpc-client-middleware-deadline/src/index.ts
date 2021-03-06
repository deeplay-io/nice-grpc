import {ClientError, ClientMiddleware, Status} from 'nice-grpc-common';
import AbortController from 'node-abort-controller';

export type DeadlineOptions = {
  deadline?: Date;
};

export const deadlineMiddleware: ClientMiddleware<DeadlineOptions> =
  async function* deadlineMiddleware(call, options) {
    if (options.deadline == null) {
      return yield* call.next(call.request, options);
    }

    const {deadline, signal: origSignal, ...restOptions} = options;

    const abortController = new AbortController();

    const abortListener = () => {
      abortController.abort();
    };

    origSignal?.addEventListener('abort', abortListener);

    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      abortController.abort();      
    }, deadline.getTime() - Date.now());

    try {
      return yield* call.next(call.request, {
        ...restOptions,
        signal: abortController.signal,
      });
    } finally {
      origSignal?.removeEventListener('abort', abortListener);
      clearTimeout(timer);

      if (timedOut) {
        throw new ClientError(
          call.method.path,
          Status.DEADLINE_EXCEEDED,
          'Deadline exceeded',
        );
      }
    }
  };
