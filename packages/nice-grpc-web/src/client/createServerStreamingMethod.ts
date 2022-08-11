import {grpc} from '@improbable-eng/grpc-web';
import {AbortError, throwIfAborted} from 'abort-controller-x';
import {AsyncSink} from '../utils/AsyncSink';
import {
  CallOptions,
  ClientError,
  ClientMiddleware,
  Metadata,
  MethodDescriptor,
  Status,
} from 'nice-grpc-common';
import {
  MethodDefinition,
  toGrpcWebMethodDefinition,
} from '../service-definitions';
import {
  convertMetadataFromGrpcWeb,
  convertMetadataToGrpcWeb,
} from '../utils/convertMetadata';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {Channel} from './channel';
import {ServerStreamingClientMethod} from './Client';

/** @internal */
export function createServerStreamingMethod<Request, Response>(
  definition: MethodDefinition<Request, unknown, unknown, Response>,
  channel: Channel,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): ServerStreamingClientMethod<Request, Response> {
  const grpcMethodDefinition = toGrpcWebMethodDefinition(definition);

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

    const {
      metadata = Metadata(),
      signal = new AbortController().signal,
      onHeader,
      onTrailer,
    } = options;

    const sink = new AsyncSink<Response>();

    const client = grpc.client<any, any, any>(grpcMethodDefinition, {
      host: channel.address,
      transport: channel.transport,
    });

    client.onHeaders(headers => {
      onHeader?.(convertMetadataFromGrpcWeb(headers));
    });

    client.onMessage(message => {
      sink.write(message);
    });

    client.onEnd((code, message, trailers) => {
      onTrailer?.(convertMetadataFromGrpcWeb(trailers));

      if (code === grpc.Code.OK) {
        sink.end();
      } else {
        sink.error(new ClientError(definition.path, +code as Status, message));
      }
    });

    client.start(convertMetadataToGrpcWeb(metadata));
    client.send({
      serializeBinary: () => definition.requestSerialize(request),
    });
    client.finishSend();

    const abortListener = () => {
      sink.error(new AbortError());
      client.close();
    };

    signal.addEventListener('abort', abortListener);

    try {
      yield* sink;
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
