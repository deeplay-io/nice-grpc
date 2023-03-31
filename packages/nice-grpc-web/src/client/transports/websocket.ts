import {
  AbortError,
  isAbortError,
  throwIfAborted,
  waitForEvent,
} from 'abort-controller-x';
import WebSocket from 'isomorphic-ws';
import {Base64} from 'js-base64';
import {Metadata} from 'nice-grpc-common';
import {AsyncSink} from '../../utils/AsyncSink';
import {Frame, Transport} from '../Transport';

/**
 * Transport based on WebSockets. Works only with `grpcwebproxy`.
 */
export function WebsocketTransport(): Transport {
  return async function* ({url, body, metadata, signal}) {
    if (signal.aborted) {
      throw new AbortError();
    }

    const frames = new AsyncSink<Frame>();

    signal.addEventListener('abort', () => {
      frames.error(new AbortError());
    });

    const websocketUrl = new URL(url);

    websocketUrl.protocol = websocketUrl.protocol.replace('http', 'ws');

    const webSocket = new WebSocket(websocketUrl, ['grpc-websockets']);
    webSocket.binaryType = 'arraybuffer';

    webSocket.addEventListener('message', event => {
      if (event.data instanceof ArrayBuffer) {
        frames.write({
          type: 'data',
          data: new Uint8Array(event.data),
        });
      } else {
        frames.error(
          new Error(`Unexpected message type: ${typeof event.data}`),
        );
      }
    });

    webSocket.addEventListener('close', event => {
      if (event.wasClean) {
        frames.end();
      } else {
        frames.error(
          new Error(
            `WebSocket closed with code ${event.code}` +
              (event.reason && `: ${event.reason}`),
          ),
        );
      }
    });

    const pipeAbortController = new AbortController();

    pipeBody(pipeAbortController.signal, metadata, body, webSocket).catch(
      err => {
        if (!isAbortError(err)) {
          frames.error(err);
        }
      },
    );

    try {
      return yield* frames;
    } finally {
      pipeAbortController.abort();
      webSocket.close();
    }
  };
}

async function pipeBody(
  signal: AbortSignal,
  metadata: Metadata,
  body: AsyncIterable<Uint8Array>,
  webSocket: WebSocket,
): Promise<void> {
  if (webSocket.readyState == WebSocket.CONNECTING) {
    await waitForEvent(signal, webSocket, 'open');
  }

  webSocket.send(encodeMetadata(metadata));

  for await (const chunk of body) {
    throwIfAborted(signal);

    const data = new Uint8Array(chunk.length + 1);
    data.set([0], 0);
    data.set(chunk, 1);

    webSocket.send(data);
  }

  webSocket.send(new Uint8Array([1]));
}

function encodeMetadata(metadata: Metadata): Uint8Array {
  let result = '';

  for (const [key, values] of metadata) {
    for (const value of values) {
      const valueString =
        typeof value === 'string' ? value : Base64.fromUint8Array(value);

      const pairString = `${key}: ${valueString}\r\n`;

      for (let i = 0; i < pairString.length; i++) {
        const charCode = pairString.charCodeAt(i);

        if (!isValidCharCode(charCode)) {
          throw new Error(
            `Metadata contains invalid characters: '${pairString}'`,
          );
        }
      }

      result += pairString;
    }
  }

  return new TextEncoder().encode(result);
}

/**
 * Checks whether the given number represents a valid character code.
 * It returns true if the number is 0x9 (tab), 0xa (line feed), 0xd (carriage
 * return), or any printable character.
 */
function isValidCharCode(val: number): boolean {
  return (
    val === 0x9 || val === 0xa || val === 0xd || (val >= 0x20 && val <= 0x7e)
  );
}
