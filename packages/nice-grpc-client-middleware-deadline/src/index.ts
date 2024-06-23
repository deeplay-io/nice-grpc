import {ClientError, ClientMiddleware, Status} from 'nice-grpc-common';

export type DeadlineOptions = {
  /**
   * Deadline for the call.
   *
   * If `Date`, it will be interpreted as an absolute time.
   * If number, it will be interpreted as a relative time in milliseconds.
   * By default, there is no deadline.
   */
  deadline?: Date | number;
};

/**
 * Client middleware that adds support for setting deadline for a call, after
 * which the call will get cancelled, and a `ClientError` with status code
 * `DEADLINE_EXCEEDED` will be thrown.
 */
export const deadlineMiddleware: ClientMiddleware<DeadlineOptions> =
  async function* deadlineMiddleware(call, options) {
    if (options.deadline == null || options.signal?.aborted) {
      return yield* call.next(call.request, options);
    }

    const {deadline, signal: origSignal, ...restOptions} = options;

    const abortController = new AbortController();

    const abortListener = () => {
      abortController.abort();
    };

    origSignal?.addEventListener('abort', abortListener);

    let timedOut = false;

    const offset =
      deadline instanceof Date ? deadline.getTime() - Date.now() : deadline;
    const timer = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, offset);

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
