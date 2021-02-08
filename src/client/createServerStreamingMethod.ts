import {Client, Metadata, MethodDefinition} from '@grpc/grpc-js';
import {throwIfAborted} from 'abort-controller-x';
import AbortController from 'node-abort-controller';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {readableToAsyncIterable} from '../utils/readableToAsyncIterable';
import {CallOptions} from './CallOptions';
import {ServerStreamingClientMethod} from './Client';
import {wrapClientError} from './ClientError';
import {ClientMiddleware} from './ClientMiddleware';

/** @internal */
export function createServerStreamingMethod<Request, Response>(
  definition: MethodDefinition<Request, Response>,
  client: Client,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): ServerStreamingClientMethod<Request, Response> {
  async function* serverStreamingMethod(
    request: Request,
    options: CallOptions,
  ): AsyncGenerator<Response, void, undefined> {
    if (isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for server streaming method',
      );
    }

    const {
      deadline,
      metadata = new Metadata(),
      signal = new AbortController().signal,
      onHeader,
      onTrailer,
    } = options;

    const call = client.makeServerStreamRequest(
      definition.path,
      definition.requestSerialize,
      definition.responseDeserialize,
      request,
      metadata,
      {
        deadline,
      },
    );

    call.on('metadata', metadata => {
      onHeader?.(metadata);
    });
    call.on('status', status => {
      onTrailer?.(status.metadata);
    });

    const abortListener = () => {
      call.cancel();
    };

    signal.addEventListener('abort', abortListener);

    try {
      yield* readableToAsyncIterable(call);
    } catch (err) {
      throw wrapClientError(err, definition.path);
    } finally {
      signal.removeEventListener('abort', abortListener);
      throwIfAborted(signal);
    }
  }

  const method =
    middleware == null
      ? serverStreamingMethod
      : (request: Request, options: CallOptions) =>
          middleware(
            {
              definition,
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
      async *[Symbol.asyncIterator]() {
        while (true) {
          const result = await iterator.next();

          if (!result.done) {
            yield result.value;
          } else {
            if (result.value != null) {
              throw new Error(
                'A middleware returned a message, but expected to return void for server streaming method',
              );
            }

            break;
          }
        }
      },
    };
  };
}
