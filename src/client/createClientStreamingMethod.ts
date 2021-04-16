import {
  Client,
  ClientWritableStream,
  Metadata,
  MethodDefinition,
} from '@grpc/grpc-js';
import {
  execute,
  isAbortError,
  throwIfAborted,
  waitForEvent,
} from 'abort-controller-x';
import AbortController, {AbortSignal} from 'node-abort-controller';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import {patchClientWritableStream} from '../utils/patchClientWritableStream';
import {CallOptions} from './CallOptions';
import {ClientStreamingClientMethod} from './Client';
import {wrapClientError} from './ClientError';
import {ClientMiddleware} from './ClientMiddleware';

/** @internal */
export function createClientStreamingMethod<Request, Response>(
  definition: MethodDefinition<Request, Response>,
  client: Client,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): ClientStreamingClientMethod<Request, Response> {
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
      deadline,
      metadata = new Metadata(),
      signal = new AbortController().signal,
      onHeader,
      onTrailer,
    } = options;

    return await execute<Response>(signal, (resolve, reject) => {
      const pipeAbortController = new AbortController();

      const call = client.makeClientStreamRequest(
        definition.path,
        definition.requestSerialize,
        definition.responseDeserialize,
        metadata,
        {
          deadline,
        },
        (err, response) => {
          pipeAbortController.abort();

          if (err != null) {
            reject(wrapClientError(err, definition.path));
          } else {
            resolve(response!);
          }
        },
      );

      patchClientWritableStream(call);

      call.on('metadata', metadata => {
        onHeader?.(metadata);
      });
      call.on('status', status => {
        onTrailer?.(status.metadata);
      });

      pipeRequest(pipeAbortController.signal, request, call).then(
        () => {
          call.end();
        },
        err => {
          if (!isAbortError(err)) {
            reject(err);
            call.cancel();
          }
        },
      );

      return () => {
        pipeAbortController.abort();
        call.cancel();
      };
    });
  }

  const method =
    middleware == null
      ? clientStreamingMethod
      : (request: AsyncIterable<Request>, options: CallOptions) =>
          middleware(
            {
              definition,
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

    const result = await iterator.next();

    if (!result.done) {
      throw new Error(
        'A middleware yielded a message, but expected to only return a message for client streaming method',
      );
    }

    if (result.value == null) {
      throw new Error(
        'A middleware returned void, but expected to return a message for client streaming method',
      );
    }

    return result.value;
  };
}

async function pipeRequest<Request>(
  signal: AbortSignal,
  request: AsyncIterable<Request>,
  call: ClientWritableStream<Request>,
): Promise<void> {
  for await (const item of request) {
    throwIfAborted(signal);

    const shouldContinue = call.write(item);

    if (!shouldContinue) {
      await waitForEvent(signal, call, 'drain');
    }
  }
}
