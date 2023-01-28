import {isAbortError} from 'abort-controller-x';
import {CallOptions, ClientError, Metadata, Status} from 'nice-grpc-common';
import {MethodDefinition} from '../service-definitions';
import {Channel} from './channel';
import {decodeResponse} from './decodeResponse';
import {encodeRequest} from './encodeRequest';
import {makeInternalErrorMessage} from './makeInternalErrorMessage';
import {parseTrailer} from './parseTrailer';

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

  let status: Status | undefined;
  let message: string | undefined;

  function handleTrailer(trailer: Metadata) {
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

  const response = decodeResponse({
    response: channel.transport({
      url: channel.address + definition.path,
      metadata: finalMetadata,
      body: encodeRequest({
        request: interceptRequestError(),
        encode: definition.requestSerialize,
      }),
      signal: innerAbortController.signal,
      method: definition,
    }),
    decode: definition.responseDeserialize,
    onHeader(header) {
      const isTrailerOnly = header.has('grpc-status');

      if (isTrailerOnly) {
        handleTrailer(header);
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
  }

  if (status == null) {
    throw new ClientError(
      definition.path,
      Status.INTERNAL,
      'Server did not return a status',
    );
  } else if (status !== Status.OK) {
    throw new ClientError(definition.path, status, message ?? '');
  }
}
