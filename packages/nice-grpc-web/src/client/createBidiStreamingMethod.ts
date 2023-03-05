import {
  CallOptions,
  ClientMiddleware,
  MethodDescriptor,
} from 'nice-grpc-common';
import {MethodDefinition} from '../service-definitions';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {Channel} from './channel';
import {BidiStreamingClientMethod} from './Client';
import {makeCall} from './makeCall';

/** @internal */
export function createBidiStreamingMethod<Request, Response>(
  definition: MethodDefinition<Request, unknown, unknown, Response>,
  channel: Channel,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): BidiStreamingClientMethod<Request, Response> {
  const methodDescriptor: MethodDescriptor = {
    path: definition.path,
    requestStream: definition.requestStream,
    responseStream: definition.responseStream,
    options: definition.options,
  };

  async function* bidiStreamingMethod(
    request: AsyncIterable<Request>,
    options: CallOptions,
  ): AsyncGenerator<Response, void, undefined> {
    if (!isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for bidirectional streaming method',
      );
    }

    const response = makeCall(definition, channel, request, options);

    yield* response;
  }

  const method =
    middleware == null
      ? bidiStreamingMethod
      : (request: AsyncIterable<Request>, options: CallOptions) =>
          middleware(
            {
              method: methodDescriptor,
              requestStream: true,
              request,
              responseStream: true,
              next: bidiStreamingMethod,
            },
            options,
          );

  return (request, options) => {
    const iterable = method(request, {
      ...defaultOptions,
      ...options,
    });
    const iterator = iterable[Symbol.asyncIterator]();

    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            const result = await iterator.next();

            if (result.done && result.value != null) {
              return await iterator.throw(
                new Error(
                  'A middleware returned a message, but expected to return void for bidirectional streaming method',
                ),
              );
            }

            return result;
          },
          return() {
            return iterator.return();
          },
          throw(err) {
            return iterator.throw(err);
          },
        };
      },
    };
  };
}
