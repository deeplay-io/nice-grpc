import {handleUnaryCall, MethodDefinition} from '@grpc/grpc-js';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {CallContext, createCallContext} from './CallContext';
import {createErrorStatusObject} from './createErrorStatusObject';
import {ServerMiddleware} from './ServerMiddleware';
import {UnaryMethodImplementation} from './ServiceImplementation';

/** @internal */
export function createUnaryMethodHandler<Request, Response>(
  definition: MethodDefinition<Request, Response>,
  implementation: UnaryMethodImplementation<Request, Response>,
  middleware?: ServerMiddleware,
): handleUnaryCall<Request, Response> {
  async function* unaryMethodHandler(
    request: Request,
    context: CallContext,
  ) {
    if (isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for unary method',
      );
    }

    return await implementation(request, context);
  }

  const handler =
    middleware == null
      ? unaryMethodHandler
      : (request: Request, context: CallContext) =>
          middleware(
            {
              definition,
              requestStream: false,
              request,
              responseStream: false,
              next: unaryMethodHandler,
            },
            context,
          );

  return (call, callback) => {
    const context = createCallContext(call);

    Promise.resolve()
      .then(async () => {
        const iterable = handler(call.request, context);
        const iterator = iterable[Symbol.asyncIterator]();

        const result = await iterator.next();

        if (!result.done) {
          throw new Error(
            'A middleware yielded a message, but expected to only return a message for unary method',
          );
        }

        if (result.value == null) {
          throw new Error(
            'A middleware returned void, but expected to return a message for unary method',
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
