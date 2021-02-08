import {
  Client,
  ClientWritableStream,
  Metadata,
  MethodDefinition,
} from '@grpc/grpc-js';
import {isAbortError, throwIfAborted, waitForEvent} from 'abort-controller-x';
import AbortController from 'node-abort-controller';
import {isAsyncIterable} from '../utils/isAsyncIterable';
import { patchClientWritableStream } from '../utils/patchClientWritableStream';
import {readableToAsyncIterable} from '../utils/readableToAsyncIterable';
import {CallOptions} from './CallOptions';
import {BidiStreamingClientMethod} from './Client';
import {wrapClientError} from './ClientError';
import {ClientMiddleware} from './ClientMiddleware';

/** @internal */
export function createBidiStreamingMethod<Request, Response>(
  definition: MethodDefinition<Request, Response>,
  client: Client,
  middleware: ClientMiddleware | undefined,
  defaultOptions: CallOptions,
): BidiStreamingClientMethod<Request, Response> {
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
      deadline,
      metadata = new Metadata(),
      signal = new AbortController().signal,
      onHeader,
      onTrailer,
    } = options;

    const pipeAbortController = new AbortController();

    const call = client.makeBidiStreamRequest(
      definition.path,
      definition.requestSerialize,
      definition.responseDeserialize,
      metadata,
      {
        deadline,
      },
    );

    patchClientWritableStream(call);

    call.on('metadata', metadata => {
      onHeader?.(metadata);
    });
    call.on('status', status => {
      onTrailer?.(status.metadata);
    });

    let pipeError: unknown;

    pipeRequest(pipeAbortController.signal, request, call).then(
      () => {
        call.end();
      },
      err => {
        if (!isAbortError(err)) {
          pipeError = err;
          call.cancel();
        }
      },
    );

    const abortListener = () => {
      pipeAbortController.abort();
      call.cancel();
    };

    signal.addEventListener('abort', abortListener);

    try {
      yield* readableToAsyncIterable(call);
    } catch (err) {
      throw wrapClientError(err, definition.path);
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
              definition,
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
      async *[Symbol.asyncIterator]() {
        while (true) {
          const result = await iterator.next();

          if (!result.done) {
            yield result.value;
          } else {
            if (result.value != null) {
              throw new Error(
                'A middleware returned a message, but expected to return void for bidirectional streaming method',
              );
            }

            break;
          }
        }
      },
    };
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
