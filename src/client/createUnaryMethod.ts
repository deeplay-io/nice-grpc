import {Client, Metadata, MethodDefinition} from '@grpc/grpc-js';
import {execute} from 'abort-controller-x';
import AbortController from 'node-abort-controller';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {CallOptions} from './CallOptions';
import {UnaryClientMethod} from './Client';
import {wrapClientError} from './ClientError';
import {ClientMiddleware} from './ClientMiddleware';

/** @internal */
export function createUnaryMethod<Request, Response>(
  definition: MethodDefinition<Request, Response>,
  client: Client,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): UnaryClientMethod<Request, Response> {
  async function* unaryMethod(
    request: Request,
    options: CallOptions,
  ): AsyncGenerator<never, Response, undefined> {
    if (isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for unary method',
      );
    }

    const {
      deadline,
      metadata = new Metadata(),
      signal = new AbortController().signal,
      onHeader,
      onTrailer,
    } = options;

    return await execute<Response>(signal, (resolve, reject) => {
      const call = client.makeUnaryRequest(
        definition.path,
        definition.requestSerialize,
        definition.responseDeserialize,
        request,
        metadata,
        {
          deadline,
        },
        (err, response) => {
          if (err != null) {
            reject(wrapClientError(err, definition.path));
          } else {
            resolve(response!);
          }
        },
      );

      call.on('metadata', metadata => {
        onHeader?.(metadata);
      });
      call.on('status', status => {
        onTrailer?.(status.metadata);
      });

      return () => {
        call.cancel();
      };
    });
  }

  const method =
    middleware == null
      ? unaryMethod
      : (request: Request, options: CallOptions) =>
          middleware(
            {
              definition,
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
  };
}
