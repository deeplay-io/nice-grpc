import {
  CallContext,
  ServerError,
  ServerMiddleware,
  ServerMiddlewareCall,
  Status,
} from 'nice-grpc-common';
import AbortController from 'node-abort-controller';

export type TerminatorContext = {
  abortOnTerminate(): void;
};

export type TerminatorMiddleware = ServerMiddleware<TerminatorContext> & {
  terminate(): void;
};

export function TerminatorMiddleware(): TerminatorMiddleware {
  let terminated = false;
  const abortControllers = new Set<AbortController>();

  async function* terminatorMiddleware<Request, Response>(
    call: ServerMiddlewareCall<Request, Response, TerminatorContext>,
    context: CallContext,
  ): AsyncGenerator<Response, Response | void, undefined> {
    const innerAbortController = new AbortController();

    const abortListener = () => {
      innerAbortController.abort();
    };

    context.signal.addEventListener('abort', abortListener);

    try {
      return yield* call.next(call.request, {
        ...context,
        signal: innerAbortController.signal,
        abortOnTerminate() {
          if (!terminated) {
            abortControllers.add(innerAbortController);
          } else {
            innerAbortController.abort();
          }
        },
      });
    } catch (err) {
      if (innerAbortController.signal.aborted && !context.signal.aborted) {
        throw new ServerError(Status.UNAVAILABLE, 'Server shutting down');
      }

      throw err;
    } finally {
      context.signal.removeEventListener('abort', abortListener);
      abortControllers.delete(innerAbortController);
    }
  }

  return Object.assign(terminatorMiddleware, {
    terminate() {
      if (terminated) {
        return;
      }

      terminated = true;

      for (const abortController of abortControllers) {
        abortController.abort();
      }

      abortControllers.clear();
    },
  });
}
