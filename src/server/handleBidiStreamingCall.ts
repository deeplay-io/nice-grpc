import {handleBidiStreamingCall, MethodDefinition} from '@grpc/grpc-js';
import {waitForEvent} from 'abort-controller-x';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {readableToAsyncIterable} from '../utils/readableToAsyncIterable';
import {CallContext, createCallContext} from './CallContext';
import {createErrorStatusObject} from './createErrorStatusObject';
import {ServerMiddleware} from './ServerMiddleware';
import {BidiStreamingMethodImplementation} from './ServiceImplementation';

/** @internal */
export function createBidiStreamingMethodHandler<Request, Response>(
  definition: MethodDefinition<Request, Response>,
  implementation: BidiStreamingMethodImplementation<Request, Response>,
  middleware?: ServerMiddleware,
): handleBidiStreamingCall<Request, Response> {
  async function* bidiStreamingMethodHandler(
    request: AsyncIterable<Request>,
    context: CallContext,
  ) {
    if (!isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for bidirectional streaming method',
      );
    }

    yield* implementation(request, context);
  }

  const handler =
    middleware == null
      ? bidiStreamingMethodHandler
      : (request: AsyncIterable<Request>, context: CallContext) =>
          middleware(
            {
              definition,
              requestStream: true,
              request,
              responseStream: true,
              next: bidiStreamingMethodHandler,
            },
            context,
          );

  return call => {
    const context = createCallContext(call);

    Promise.resolve()
      .then(async () => {
        const iterable = handler(readableToAsyncIterable(call), context);
        const iterator = iterable[Symbol.asyncIterator]();

        while (true) {
          const result = await iterator.next();

          if (!result.done) {
            const shouldContinue = call.write(result.value);

            if (!shouldContinue) {
              await waitForEvent(context.signal, call, 'drain');
            }
          } else {
            if (result.value != null) {
              throw new Error(
                'A middleware returned a message, but expected to return void for bidirectional streaming method',
              );
            }

            break;
          }
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
