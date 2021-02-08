import {handleClientStreamingCall, MethodDefinition} from '@grpc/grpc-js';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {CallContext, createCallContext} from './CallContext';
import {ServerMiddleware} from './ServerMiddleware';
import {ClientStreamingMethodImplementation} from './ServiceImplementation';
import {createErrorStatusObject} from './createErrorStatusObject';
import {readableToAsyncIterable} from '../utils/readableToAsyncIterable';

/** @internal */
export function createClientStreamingMethodHandler<Request, Response>(
  definition: MethodDefinition<Request, Response>,
  implementation: ClientStreamingMethodImplementation<Request, Response>,
  middleware?: ServerMiddleware,
): handleClientStreamingCall<Request, Response> {
  async function* clientStreamingMethodHandler(
    request: AsyncIterable<Request>,
    context: CallContext,
  ) {
    if (!isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for client streaming method',
      );
    }

    return await implementation(request, context);
  }

  const handler =
    middleware == null
      ? clientStreamingMethodHandler
      : (request: AsyncIterable<Request>, context: CallContext) =>
          middleware(
            {
              definition,
              requestStream: true,
              request,
              responseStream: false,
              next: clientStreamingMethodHandler,
            },
            context,
          );

  return (call, callback) => {
    const context = createCallContext(call);

    Promise.resolve()
      .then(async () => {
        const iterable = handler(readableToAsyncIterable(call), context);
        const iterator = iterable[Symbol.asyncIterator]();

        const result = await iterator.next();

        if (!result.done) {
          throw new Error(
            'A middleware yielded a message, but expected to only return a message for client streaming method',
          );
        }

        if (result.value == null) {
          throw new Error(
            'A middleware returned void, but expected to return a message for client streaming method',
          );
        }

        return result.value;
      })
      .then(
        res => {
          callback(null, res, context.trailer);
        },
        err => {
          callback(createErrorStatusObject(err, context.trailer));
        },
      );
  };
}
