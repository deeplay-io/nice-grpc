import {throwIfAborted} from 'abort-controller-x';
import {Base64} from 'js-base64';
import {ClientError, Metadata, Status} from 'nice-grpc-common';
import {Transport} from '../Transport';

export interface FetchTransportConfig {
  credentials?: RequestCredentials;
  cache?: RequestCache;
}

/**
 * Transport for browsers based on `fetch` API.
 */
export function FetchTransport(config?: FetchTransportConfig): Transport {
  return async function* fetchTransport({url, body, metadata, signal, method}) {
    let requestBody: BodyInit;

    if (!method.requestStream) {
      let bodyBuffer: Uint8Array | undefined;

      for await (const chunk of body) {
        bodyBuffer = chunk;

        break;
      }

      requestBody = bodyBuffer!;
    } else {
      let iterator: AsyncIterator<Uint8Array> | undefined;

      requestBody = new ReadableStream({
        type: 'bytes',
        start() {
          iterator = body[Symbol.asyncIterator]();
        },

        async pull(controller) {
          const {done, value} = await iterator!.next();

          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        },
        async cancel() {
          await iterator!.return?.();
        },
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      body: requestBody,
      headers: metadataToHeaders(metadata),
      signal,
      cache: config?.cache,
      ['duplex' as any]: 'half',
      credentials: config?.credentials,
    });

    yield {
      type: 'header',
      header: headersToMetadata(response.headers),
    };

    if (!response.ok) {
      const responseText = await response.text();

      throw new ClientError(
        method.path,
        getStatusFromHttpCode(response.status),
        getErrorDetailsFromHttpResponse(response.status, responseText),
      );
    }

    throwIfAborted(signal);

    const reader = response.body!.getReader();

    const abortListener = () => {
      reader.cancel().catch(() => {});
    };

    signal.addEventListener('abort', abortListener);

    try {
      while (true) {
        const {done, value} = await reader.read();

        if (value != null) {
          yield {
            type: 'data',
            data: value,
          };
        }

        if (done) {
          break;
        }
      }
    } finally {
      signal.removeEventListener('abort', abortListener);

      throwIfAborted(signal);
    }
  };
}

function metadataToHeaders(metadata: Metadata): Headers {
  const headers = new Headers();

  for (const [key, values] of metadata) {
    for (const value of values) {
      headers.append(
        key,
        typeof value === 'string' ? value : Base64.fromUint8Array(value),
      );
    }
  }

  return headers;
}

function headersToMetadata(headers: Headers): Metadata {
  const metadata = new Metadata();

  for (const [key, value] of headers) {
    if (key.endsWith('-bin')) {
      for (const item of value.split(/,\s?/)) {
        metadata.append(key, Base64.toUint8Array(item));
      }
    } else {
      metadata.set(key, value);
    }
  }

  return metadata;
}

function getStatusFromHttpCode(statusCode: number): Status {
  switch (statusCode) {
    case 400:
      return Status.INTERNAL;
    case 401:
      return Status.UNAUTHENTICATED;
    case 403:
      return Status.PERMISSION_DENIED;
    case 404:
      return Status.UNIMPLEMENTED;
    case 429:
    case 502:
    case 503:
    case 504:
      return Status.UNAVAILABLE;
    default:
      return Status.UNKNOWN;
  }
}

function getErrorDetailsFromHttpResponse(
  statusCode: number,
  responseText: string,
): string {
  return (
    `Received HTTP ${statusCode} response: ` +
    (responseText.length > 1000
      ? responseText.slice(0, 1000) + '... (truncated)'
      : responseText)
  );
}
