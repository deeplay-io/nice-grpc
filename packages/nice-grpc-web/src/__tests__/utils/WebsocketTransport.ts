import {grpc} from '@improbable-eng/grpc-web';
import WebSocket = require('ws');

import Metadata = grpc.Metadata;
import Transport = grpc.Transport;
import TransportFactory = grpc.TransportFactory;
import TransportOptions = grpc.TransportOptions;

enum WebsocketSignal {
  FINISH_SEND = 1,
}

const finishSendFrame = new Uint8Array([1]);

export function WebsocketTransport(): TransportFactory {
  return (opts: TransportOptions) => {
    return websocketRequest(opts);
  };
}

function websocketRequest(options: TransportOptions): Transport {
  // console.log('websocketRequest', options);

  let webSocketAddress = constructWebSocketAddress(options.url);

  const sendQueue: Array<Uint8Array | WebsocketSignal> = [];
  let ws: WebSocket;

  function sendToWebsocket(toSend: Uint8Array | WebsocketSignal) {
    if (toSend === WebsocketSignal.FINISH_SEND) {
      ws.send(finishSendFrame);
    } else {
      const byteArray = toSend as Uint8Array;
      const c = new Int8Array(byteArray.byteLength + 1);
      c.set(new Uint8Array([0]));

      c.set(byteArray as any as ArrayLike<number>, 1);

      ws.send(c);
    }
  }

  return {
    sendMessage: (msgBytes: Uint8Array) => {
      if (!ws || ws.readyState === ws.CONNECTING) {
        sendQueue.push(msgBytes);
      } else {
        sendToWebsocket(msgBytes);
      }
    },
    finishSend: () => {
      if (!ws || ws.readyState === ws.CONNECTING) {
        sendQueue.push(WebsocketSignal.FINISH_SEND);
      } else {
        sendToWebsocket(WebsocketSignal.FINISH_SEND);
      }
    },
    start: (metadata: Metadata) => {
      ws = new WebSocket(webSocketAddress, ['grpc-websockets']);
      ws.binaryType = 'arraybuffer';
      ws.onopen = function () {
        // console.log('websocketRequest.onopen');
        ws.send(headersToBytes(metadata));

        // send any messages that were passed to sendMessage before the connection was ready
        sendQueue.forEach(toSend => {
          sendToWebsocket(toSend);
        });
      };

      ws.onclose = function (closeEvent) {
        // console.log('websocketRequest.onclose', closeEvent);
        options.onEnd();
      };

      ws.onerror = function (error) {
        // console.log('websocketRequest.onerror', error);
      };

      ws.onmessage = function (e) {
        options.onChunk(Buffer.from(e.data as any));
      };
    },
    cancel: () => {
      // console.log('websocket.abort');
      ws.close();
    },
  };
}

function constructWebSocketAddress(url: string) {
  if (url.substr(0, 8) === 'https://') {
    return `wss://${url.substr(8)}`;
  } else if (url.substr(0, 7) === 'http://') {
    return `ws://${url.substr(7)}`;
  }
  throw new Error(
    'Websocket transport constructed with non-https:// or http:// host.',
  );
}

function headersToBytes(headers: Metadata): Uint8Array {
  let asString = '';
  headers.forEach((key, values) => {
    values.forEach(value => {
      asString += `${key}: ${value}\r\n`;
    });
  });
  return encodeASCII(asString);
}

const isAllowedControlChars = (char: number) =>
  char === 0x9 || char === 0xa || char === 0xd;

function isValidHeaderAscii(val: number): boolean {
  return isAllowedControlChars(val) || (val >= 0x20 && val <= 0x7e);
}

function encodeASCII(input: string): Uint8Array {
  const encoded = new Uint8Array(input.length);
  for (let i = 0; i !== input.length; ++i) {
    const charCode = input.charCodeAt(i);
    if (!isValidHeaderAscii(charCode)) {
      throw new Error('Metadata contains invalid ASCII');
    }
    encoded[i] = charCode;
  }
  return encoded;
}
