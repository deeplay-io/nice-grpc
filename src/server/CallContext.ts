import {Metadata} from '@grpc/grpc-js';
import {ServerSurfaceCall} from '@grpc/grpc-js/build/src/server-call';
import AbortController from 'node-abort-controller';

/**
 * Call context passed to server methods.
 */
export type CallContext = {
  /**
   * Request metadata from client.
   */
  metadata: Metadata;
  /**
   * Client address.
   */
  peer: string;
  /**
   * Response header. Sent with the first response, or when `sendHeader` is
   * called.
   */
  header: Metadata;
  /**
   * Manually send response header.
   */
  sendHeader(): void;
  /**
   * Response trailer. Sent when server method returns or throws.
   */
  trailer: Metadata;
  /**
   * Signal that is aborted once the call gets cancelled.
   */
  signal: AbortSignal;
};

/** @internal */
export function createCallContext(call: ServerSurfaceCall): CallContext {
  const header = new Metadata();
  const trailer = new Metadata();

  const abortController = new AbortController();

  if (call.cancelled) {
    abortController.abort();
  } else {
    call.on('cancelled', () => {
      abortController.abort();
    });
  }

  return {
    metadata: call.metadata,
    peer: call.getPeer(),
    header,
    sendHeader() {
      // TODO: make readonly
      call.sendMetadata(header);
    },
    trailer,
    signal: abortController.signal,
  };
}
