import {isAbortError, rethrowAbortError} from 'abort-controller-x';
import {CallOptions, ClientError, Metadata, Status} from 'nice-grpc-common';
import {MethodDefinition} from '../service-definitions';
import {Channel} from './channel';
import {decodeResponse} from './decodeResponse';
import {encodeRequest} from './encodeRequest';
import {makeInternalErrorMessage} from './makeInternalErrorMessage';
import {parseTrailer} from './parseTrailer';

/** @internal */
export async function* makeCall<Request, Response>(
  definition: MethodDefinition<Request, unknown, unknown, Response>,
  channel: Channel,
  request: AsyncIterable<Request>,
  options: CallOptions,
): AsyncIterable<Response> {
  const {
    metadata,
    signal = new AbortController().signal,
    onHeader,
    onTrailer,
  } = options;

  let receivedTrailersOnly = false;
  let status: Status | undefined;
  let message: string | undefined;

  function handleTrailer(trailer: Metadata) {
    if (receivedTrailersOnly) {
      if (new Map(trailer).size > 0) {
        throw new ClientError(
          definition.path,
          Status.INTERNAL,
          'Received non-empty trailer after trailers-only response',
        );
      } else {
        return;
      }
    }

    const parsedTrailer = parseTrailer(trailer);

    ({status, message} = parsedTrailer);
    onTrailer?.(parsedTrailer.trailer);
  }

  const finalMetadata = Metadata(metadata);

  finalMetadata.set('content-type', 'application/grpc-web+proto');
  finalMetadata.set('x-grpc-web', '1');

  const innerAbortController = new AbortController();

  const abortListener = () => {
    innerAbortController.abort();
  };

  signal.addEventListener('abort', abortListener);

  let finished = false;
  let requestError: {err: unknown} | undefined;

  async function* interceptRequestError() {
    try {
      for await (const item of request) {
        if (finished) {
          throw new Error('Request finished');
        }

        yield item;
      }
    } catch (err) {
      requestError = {err};
      innerAbortController.abort();
      throw err;
    }
  }

  async function* handleTransportErrors() {
    try {
      return yield* channel.transport({
        url: channel.address + definition.path,
        metadata: finalMetadata,
        body: encodeRequest({
          request: interceptRequestError(),
          encode: definition.requestSerialize,
        }),
        signal: innerAbortController.signal,
        method: definition,
      });
    } catch (err) {
      rethrowAbortError(err);

      throw new ClientError(
        definition.path,
        Status.UNKNOWN,
        `Transport error: ${makeInternalErrorMessage(err)}`,
      );
    }
  }

  const response = decodeResponse({
    response: handleTransportErrors(),
    decode: definition.responseDeserialize,
    onHeader(header) {
      const isTrailersOnly = header.has('grpc-status');

      if (isTrailersOnly) {
        handleTrailer(header);

        receivedTrailersOnly = true;
      } else {
        onHeader?.(header);
      }
    },
    onTrailer(trailer) {
      handleTrailer(trailer);
    },
  });

  try {
    yield* response;
  } catch (err) {
    if (requestError !== undefined) {
      throw requestError.err;
    } else if (err instanceof ClientError || isAbortError(err)) {
      throw err;
    } else {
      throw new ClientError(
        definition.path,
        Status.INTERNAL,
        makeInternalErrorMessage(err),
      );
    }
  } finally {
    finished = true;
    signal.removeEventListener('abort', abortListener);

    if (status != null && status !== Status.OK) {
      throw new ClientError(definition.path, status, message ?? '');
    }
  }

  if (status == null) {
    throw new ClientError(
      definition.path,
      Status.UNKNOWN,
      'Response stream closed without gRPC status. This may indicate a misconfigured CORS policy on the server: Access-Control-Expose-Headers must include "grpc-status" and "grpc-message".',
    );
  }
}
