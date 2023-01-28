import {
  CallOptions,
  ClientError,
  ClientMiddleware,
  MethodDescriptor,
  Status,
} from 'nice-grpc-common';
import {MethodDefinition} from '../service-definitions';
import {asyncIterableOf} from '../utils/asyncIterableOf';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {Channel} from './channel';
import {UnaryClientMethod} from './Client';
import {makeCall} from './makeCall';

/** @internal */
export function createUnaryMethod<Request, Response>(
  definition: MethodDefinition<Request, unknown, unknown, Response>,
  channel: Channel,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): UnaryClientMethod<Request, Response> {
  const methodDescriptor: MethodDescriptor = {
    path: definition.path,
    requestStream: definition.requestStream,
    responseStream: definition.responseStream,
    options: definition.options,
  };

  async function* unaryMethod(
    request: Request,
    options: CallOptions,
  ): AsyncGenerator<never, Response, undefined> {
    if (isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for unary method',
      );
    }

    const response = makeCall(
      definition,
      channel,
      asyncIterableOf(request),
      options,
    );

    let unaryResponse: Response | undefined;

    for await (const message of response) {
      if (unaryResponse != null) {
        throw new ClientError(
          definition.path,
          Status.INTERNAL,
          'Received more than one message from server for unary method',
        );
      }

      unaryResponse = message;
    }

    if (unaryResponse == null) {
      throw new ClientError(
        definition.path,
        Status.INTERNAL,
        'Server did not return a response',
      );
    }

    return unaryResponse;
  }

  const method =
    middleware == null
      ? unaryMethod
      : (request: Request, options: CallOptions) =>
          middleware(
            {
              method: methodDescriptor,
              requestStream: false,
              request,
              responseStream: false,
              next: unaryMethod,
            },
            options,
          );

  return async (request, options) => {
    const iterable = method(request, {
      ...defaultOptions,
      ...options,
    });
    const iterator = iterable[Symbol.asyncIterator]();

    let result = await iterator.next();

    while (true) {
      if (!result.done) {
        result = await iterator.throw(
          new Error(
            'A middleware yielded a message, but expected to only return a message for unary method',
          ),
        );

        continue;
      }

      if (result.value == null) {
        result = await iterator.throw(
          new Error(
            'A middleware returned void, but expected to return a message for unary method',
          ),
        );

        continue;
      }

      return result.value;
    }
  };
}
