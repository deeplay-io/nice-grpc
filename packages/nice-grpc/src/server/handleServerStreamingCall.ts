import {handleServerStreamingCall, MethodDefinition} from '@grpc/grpc-js';
import {isAbortError, waitForEvent} from 'abort-controller-x';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {CallContext, createCallContext} from './CallContext';
import {createErrorStatusObject} from './createErrorStatusObject';
import {ServerMiddleware} from './ServerMiddleware';
import {ServerStreamingMethodImplementation} from './ServiceImplementation';

/** @internal */
export function createServerStreamingMethodHandler<Request, Response>(
  definition: MethodDefinition<Request, Response>,
  implementation: ServerStreamingMethodImplementation<Request, Response>,
  middleware?: ServerMiddleware,
): handleServerStreamingCall<Request, Response> {
  async function* serverStreamingMethodHandler(
    request: Request,
    context: CallContext,
  ) {
    if (isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for server streaming method',
      );
    }

    yield* implementation(request, context);
  }

  const handler =
    middleware == null
      ? serverStreamingMethodHandler
      : (request: Request, context: CallContext) =>
          middleware(
            {
              definition,
              requestStream: false,
              request,
              responseStream: true,
              next: serverStreamingMethodHandler,
            },
            context,
          );

  return call => {
    const context = createCallContext(call);

    Promise.resolve()
      .then(async () => {
        const iterable = handler(call.request, context);
        const iterator = iterable[Symbol.asyncIterator]();

        let result = await iterator.next();

        while (true) {
          if (!result.done) {
            try {
              const shouldContinue = call.write(result.value);

              if (!shouldContinue) {
                await waitForEvent(context.signal, call, 'drain');
              }
            } catch (err) {
              result = isAbortError(err)
                ? await iterator.return()
                : await iterator.throw(err);

              continue;
            }

            result = await iterator.next();

            continue;
          }

          if (result.value != null) {
            result = await iterator.throw(
              new Error(
                'A middleware returned a message, but expected to return void for server streaming method',
              ),
            );

            continue;
          }

          break;
        }
      })
      .then(
        () => {
          call.end(context.trailer);
        },
        err => {
          call.destroy(
            createErrorStatusObject(
              definition.path,
              err,
              context.trailer,
            ) as any,
          );
        },
      );
  };
}
