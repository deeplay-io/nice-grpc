import {Transport} from '../Transport';
import http from 'http';
import https from 'https';
import assert from 'assert';
import {ClientError, Metadata, Status} from 'nice-grpc-common';
import {Base64} from 'js-base64';
import {throwIfAborted, waitForEvent} from 'abort-controller-x';

export function NodeHttpTransport(): Transport {
  return async function* nodeHttpTransport({
    url,
    body,
    metadata,
    signal,
    method,
  }) {
    let bodyBuffer: Uint8Array | undefined;
    let pipeAbortController: AbortController | undefined;

    if (!method.requestStream) {
      for await (const chunk of body) {
        bodyBuffer = chunk;

        break;
      }

      assert(bodyBuffer != null);
    } else {
      pipeAbortController = new AbortController();
    }

    const {req, res, removeAbortListener} = await new Promise<{
      req: http.ClientRequest;
      res: http.IncomingMessage;
      removeAbortListener: () => void;
    }>((resolve, reject) => {
      const headers = metadataToHeaders(metadata);

      if (bodyBuffer != null) {
        headers['Content-Length'] = bodyBuffer.byteLength.toString();
      }

      const abortListener = () => {
        pipeAbortController?.abort();
        req.destroy();
      };

      const req = (url.startsWith('https://') ? https : http).request(
        url,
        {
          method: 'POST',
          headers,
        },
        res => {
          resolve({
            req,
            res,
            removeAbortListener() {
              signal.removeEventListener('abort', abortListener);
            },
          });
        },
      );

      signal.addEventListener('abort', abortListener);

      req.on('error', err => {
        reject(err);
      });

      if (bodyBuffer != null) {
        req.write(bodyBuffer);
        req.end();
      } else {
        pipeBody(pipeAbortController!.signal, body, req).then(
          () => {
            req.end();
          },
          err => {
            req.destroy(err);
          },
        );
      }
    });

    yield {
      type: 'header',
      header: headersToMetadata(res.headers),
    };

    if (res.statusCode! < 200 || res.statusCode! >= 300) {
      const responseText = await new Promise<string>((resolve, reject) => {
        let text = '';

        res.on('data', chunk => {
          text += chunk;
        });

        res.on('error', err => {
          reject(err);
        });

        res.on('end', () => {
          resolve(text);
        });
      });

      throw new ClientError(
        method.path,
        getStatusFromHttpCode(res.statusCode!),
        getErrorDetailsFromHttpResponse(res.statusCode!, responseText),
      );
    }

    try {
      for await (const data of res) {
        yield {
          type: 'data',
          data,
        };
      }
    } finally {
      pipeAbortController?.abort();
      removeAbortListener();
      throwIfAborted(signal);
    }
  };
}

function metadataToHeaders(metadata: Metadata): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = {};

  for (const [key, values] of metadata) {
    for (const value of values) {
      headers[key] =
        typeof value === 'string' ? value : Base64.fromUint8Array(value);
    }
  }

  return headers;
}

function headersToMetadata(headers: http.IncomingHttpHeaders): Metadata {
  const metadata = new Metadata();

  for (const [key, headerValue] of Object.entries(headers)) {
    if (headerValue == null) {
      continue;
    }

    const value = Array.isArray(headerValue) ? headerValue : [headerValue];

    if (key.endsWith('-bin')) {
      for (const item of value) {
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

async function pipeBody(
  signal: AbortSignal,
  body: AsyncIterable<Uint8Array>,
  request: http.ClientRequest,
): Promise<void> {
  for await (const item of body) {
    throwIfAborted(signal);

    const shouldContinue = request.write(item);

    if (!shouldContinue) {
      await waitForEvent(signal, request, 'drain');
    }
  }
}
