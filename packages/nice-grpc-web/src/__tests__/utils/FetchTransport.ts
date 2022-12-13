import fetch, {Headers} from 'node-fetch';
import {grpc} from '@improbable-eng/grpc-web';

type Metadata = grpc.Metadata;
const Metadata = grpc.Metadata;
type Transport = grpc.Transport;
type TransportFactory = grpc.TransportFactory;
type TransportOptions = grpc.TransportOptions;

export type FetchTransportInit = Omit<
  RequestInit,
  'headers' | 'method' | 'body' | 'signal'
>;

export function FetchTransport(
  init: FetchTransportInit = {},
): TransportFactory {
  return (opts: TransportOptions) => {
    return fetchRequest(opts, init);
  };
}

function fetchRequest(
  options: TransportOptions,
  init: FetchTransportInit,
): Transport {
  options.debug && console.log('fetchRequest', options);
  return new Fetch(options, init);
}

class Fetch implements Transport {
  cancelled: boolean = false;
  options: TransportOptions;
  init: FetchTransportInit;
  reader!: ReadableStreamReader<Uint8Array>;
  metadata!: Metadata;
  controller = new AbortController();

  constructor(transportOptions: TransportOptions, init: FetchTransportInit) {
    this.options = transportOptions;
    this.init = init;
  }

  send(msgBytes: Uint8Array) {
    const headers = new Headers();

    this.metadata.forEach((key, values) => {
      for (const value of values) {
        headers.append(key, value);
      }
    });

    fetch(this.options.url, {
      ...this.init,
      headers,
      method: 'POST',
      body: Buffer.from(msgBytes),
      signal: this.controller.signal as any,
    })
      .then(res => {
        this.options.debug && console.log('Fetch.response', res);
        this.options.onHeaders(new Metadata(res.headers.raw()), res.status);

        res.body!.on('data', chunk => {
          this.options.debug && console.log('Fetch.data', chunk);
          this.options.onChunk(chunk);
        });

        res.body!.on('end', () => {
          this.options.debug && console.log('Fetch.end');
          this.options.onEnd();
        });

        return res;
      })
      .catch(err => {
        if (this.cancelled) {
          this.options.debug && console.log('Fetch.catch - request cancelled');
          return;
        }
        this.cancelled = true;
        this.options.debug && console.log('Fetch.catch', err.message);
        this.options.onEnd(err);
      });
  }

  sendMessage(msgBytes: Uint8Array) {
    this.send(msgBytes);
  }

  finishSend() {}

  start(metadata: Metadata) {
    this.metadata = metadata;
  }

  cancel() {
    if (this.cancelled) {
      this.options.debug && console.log('Fetch.cancel already cancelled');
      return;
    }
    this.cancelled = true;

    this.options.debug && console.log('Fetch.cancel.controller.abort');
    this.controller.abort();

    if (this.reader) {
      // If the reader has already been received in the pump then it can be cancelled immediately
      this.options.debug && console.log('Fetch.cancel.reader.cancel');
      this.reader.cancel().catch(e => {
        // This can be ignored. It will likely throw an exception due to the request being aborted
        this.options.debug &&
          console.log('Fetch.cancel.reader.cancel exception', e);
      });
    } else {
      this.options.debug && console.log('Fetch.cancel before reader');
    }
  }
}
