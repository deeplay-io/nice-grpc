import {ServerSurfaceCall} from '@grpc/grpc-js/build/src/server-call';
import {CallContext, Metadata} from 'nice-grpc-common';
import {
  convertMetadataFromGrpcJs,
  convertMetadataToGrpcJs,
} from '../utils/convertMetadata';

/** @internal */
export function createCallContext(call: ServerSurfaceCall): CallContext {
  const header = Metadata();
  const trailer = Metadata();

  const abortController = new AbortController();

  if (call.cancelled) {
    abortController.abort();
  } else {
    call.on('cancelled', () => {
      abortController.abort();
    });
  }

  let headerSent = false;

  return {
    metadata: convertMetadataFromGrpcJs(call.metadata),
    peer: call.getPeer(),
    header,
    sendHeader() {
      if (headerSent) {
        return;
      }

      call.sendMetadata(convertMetadataToGrpcJs(header));
      headerSent = true;
    },
    trailer,
    signal: abortController.signal,
  };
}
