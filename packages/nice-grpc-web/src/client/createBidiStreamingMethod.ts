import {
  CallOptions,
  ClientMiddleware,
  MethodDescriptor,
  ClientError,
  Metadata,
  Status,
} from 'nice-grpc-common';
import {grpc} from '@improbable-eng/grpc-web';
import {AbortError, isAbortError, throwIfAborted} from 'abort-controller-x';
import {AsyncSink} from '../utils/AsyncSink';
import {
  AnyMethodDefinition,
  MethodDefinition,
  toGrpcWebMethodDefinition,
} from '../service-definitions';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {BidiStreamingClientMethod} from './Client';
import {
  convertMetadataFromGrpcWeb,
  convertMetadataToGrpcWeb,
} from '../utils/convertMetadata';
import {Channel} from './channel';

/** @internal */
export function createBidiStreamingMethod<Request, Response>(
  definition: MethodDefinition<Request, unknown, unknown, Response>,
  channel: Channel,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): BidiStreamingClientMethod<Request, Response> {
  const grpcMethodDefinition = toGrpcWebMethodDefinition(definition);

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

    const {
      metadata = Metadata(),
      signal = new AbortController().signal,
      onHeader,
      onTrailer,
    } = options;

    const pipeAbortController = new AbortController();

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

    let pipeError: unknown;

    pipeRequest(pipeAbortController.signal, request, client, definition).then(
      () => {
        client.finishSend();
      },
      err => {
        if (!isAbortError(err)) {
          pipeError = err;
          client.close();
          sink.end();
        }
      },
    );

    const abortListener = () => {
      sink.error(new AbortError());
      pipeAbortController.abort();
      client.close();
    };

    signal.addEventListener('abort', abortListener);

    try {
      yield* sink;
    } finally {
      pipeAbortController.abort();
      signal.removeEventListener('abort', abortListener);
      throwIfAborted(signal);

      if (pipeError) {
        throw pipeError;
      }
    }
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

async function pipeRequest<Request>(
  signal: AbortSignal,
  request: AsyncIterable<Request>,
  client: grpc.Client<any, any>,
  definition: AnyMethodDefinition,
): Promise<void> {
  for await (const item of request) {
    throwIfAborted(signal);

    client.send({
      serializeBinary: () => definition.requestSerialize(item),
    });
  }
}
