import {
  CallOptions,
  ClientMiddleware,
  MethodDescriptor,
  ClientError,
  Metadata,
  Status,
} from 'nice-grpc-common';
import {grpc} from '@improbable-eng/grpc-web';
import {execute, isAbortError, throwIfAborted} from 'abort-controller-x';
import {
  AnyMethodDefinition,
  MethodDefinition,
  toGrpcWebMethodDefinition,
} from '../service-definitions';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {ClientStreamingClientMethod} from './Client';
import {
  convertMetadataFromGrpcWeb,
  convertMetadataToGrpcWeb,
} from '../utils/convertMetadata';
import {Channel} from './channel';

/** @internal */
export function createClientStreamingMethod<Request, Response>(
  definition: MethodDefinition<Request, unknown, unknown, Response>,
  channel: Channel,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): ClientStreamingClientMethod<Request, Response> {
  const grpcMethodDefinition = toGrpcWebMethodDefinition(definition);

  const methodDescriptor: MethodDescriptor = {
    path: definition.path,
    requestStream: definition.requestStream,
    responseStream: definition.responseStream,
    options: definition.options,
  };

  async function* clientStreamingMethod(
    request: AsyncIterable<Request>,
    options: CallOptions,
  ): AsyncGenerator<never, Response, undefined> {
    if (!isAsyncIterable(request)) {
      throw new Error(
        'A middleware passed invalid request to next(): expected a single message for client streaming method',
      );
    }

    const {
      metadata = Metadata(),
      signal = new AbortController().signal,
      onHeader,
      onTrailer,
    } = options;

    return await execute<Response>(signal, (resolve, reject) => {
      const pipeAbortController = new AbortController();

      let response: Response;

      const client = grpc.client<any, any, any>(grpcMethodDefinition, {
        host: channel.address,
        transport: channel.transport,
      });

      client.onHeaders(headers => {
        onHeader?.(convertMetadataFromGrpcWeb(headers));
      });

      client.onMessage(message => {
        response = message;
      });

      client.onEnd((code, message, trailers) => {
        onTrailer?.(convertMetadataFromGrpcWeb(trailers));

        pipeAbortController.abort();

        if (code === grpc.Code.OK) {
          resolve(response!);
        } else {
          reject(new ClientError(definition.path, +code as Status, message));
        }
      });

      client.start(convertMetadataToGrpcWeb(metadata));

      pipeRequest(pipeAbortController.signal, request, client, definition).then(
        () => {
          client.finishSend();
        },
        err => {
          if (!isAbortError(err)) {
            reject(err);
            client.close();
          }
        },
      );

      return () => {
        pipeAbortController.abort();
        client.close();
      };
    });
  }

  const method =
    middleware == null
      ? clientStreamingMethod
      : (request: AsyncIterable<Request>, options: CallOptions) =>
          middleware(
            {
              method: methodDescriptor,
              requestStream: true,
              request,
              responseStream: false,
              next: clientStreamingMethod,
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
            'A middleware yielded a message, but expected to only return a message for client streaming method',
          ),
        );

        continue;
      }

      if (result.value == null) {
        result = await iterator.throw(
          new Error(
            'A middleware returned void, but expected to return a message for client streaming method',
          ),
        );

        continue;
      }

      return result.value;
    }
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
