import {handleServerStreamingCall} from '@grpc/grpc-js';
import {isAbortError, waitForEvent} from 'abort-controller-x';
import {
  CallContext,
  MethodDescriptor,
  ServerMiddleware,
} from 'nice-grpc-common';
import {MethodDefinition} from '../service-definitions';
import {convertMetadataToGrpcJs} from '../utils/convertMetadata';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {createCallContext} from './createCallContext';
import {createErrorStatusObject} from './createErrorStatusObject';
import {ServerStreamingMethodImplementation} from './ServiceImplementation';

/** @internal */
export function createServerStreamingMethodHandler<Request, Response>(
  definition: MethodDefinition<unknown, Request, Response, unknown>,
  implementation: ServerStreamingMethodImplementation<Request, Response>,
  middleware?: ServerMiddleware,
): handleServerStreamingCall<Request, Response> {
  const methodDescriptor: MethodDescriptor = {
    path: definition.path,
    requestStream: definition.requestStream,
    responseStream: definition.responseStream,
    options: definition.options,
  };

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
              method: methodDescriptor,
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
          call.end(convertMetadataToGrpcJs(context.trailer));
        },
        err => {
          call.destroy(
            createErrorStatusObject(
              definition.path,
              err,
              convertMetadataToGrpcJs(context.trailer),
            ) as any,
          );
        },
      );
  };
}
