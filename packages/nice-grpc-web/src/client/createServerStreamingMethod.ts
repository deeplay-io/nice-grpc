import {
  CallOptions,
  ClientMiddleware,
  MethodDescriptor,
} from 'nice-grpc-common';
import {MethodDefinition} from '../service-definitions';
import {asyncIterableOf} from '../utils/asyncIterableOf';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {Channel} from './channel';
import {ServerStreamingClientMethod} from './Client';
import {makeCall} from './makeCall';

/** @internal */
export function createServerStreamingMethod<Request, Response>(
  definition: MethodDefinition<Request, unknown, unknown, Response>,
  channel: Channel,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): ServerStreamingClientMethod<Request, Response> {
  const methodDescriptor: MethodDescriptor = {
    path: definition.path,
    requestStream: definition.requestStream,
    responseStream: definition.responseStream,
    options: definition.options,
  };

  async function* serverStreamingMethod(
    request: Request,
    options: CallOptions,
  ): AsyncGenerator<Response, void, undefined> {
    if (isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for server streaming method',
      );
    }

    const response = makeCall(
      definition,
      channel,
      asyncIterableOf(request),
      options,
    );

    yield* response;
  }

  const method =
    middleware == null
      ? serverStreamingMethod
      : (request: Request, options: CallOptions) =>
          middleware(
            {
              method: methodDescriptor,
              requestStream: false,
              request,
              responseStream: true,
              next: serverStreamingMethod,
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
                  'A middleware returned a message, but expected to return void for server streaming method',
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
