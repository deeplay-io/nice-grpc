import {ServerSurfaceCall} from '@grpc/grpc-js/build/src/server-call';
import {CallContext, Metadata} from 'nice-grpc-common';
import {
  convertMetadataFromGrpcJs,
  convertMetadataToGrpcJs,
} from '../utils/convertMetadata';

// https://github.com/deeplay-io/nice-grpc/issues/607
// https://github.com/deeplay-io/nice-grpc/issues/555
export type CallContextMaybeCancel = {
  signal: AbortSignal;
  cancel?: () => void;
};

/** @internal */
export function createCallContext(
  call: ServerSurfaceCall,
  maybeCancel: CallContextMaybeCancel,
): CallContext {
  const header = Metadata();
  const trailer = Metadata();

  if (call.cancelled) {
    maybeCancel.cancel?.();
  } else {
    call.on('cancelled', () => {
      maybeCancel.cancel?.();
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
    signal: maybeCancel.signal,
  };
}
