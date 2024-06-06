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
export function createCallContext(call: ServerSurfaceCall): {
  context: CallContext;
  maybeCancel: CallContextMaybeCancel;
} {
  const ac = new AbortController();
  const maybeCancel: CallContextMaybeCancel = {
    signal: ac.signal,
    cancel() {
      ac.abort();
    },
  };

  const header = Metadata();
  const trailer = Metadata();

  if (call.cancelled) {
    maybeCancel.cancel?.();
    maybeCancel.cancel = undefined;
  } else {
    call.on('close', () => {
      maybeCancel.cancel = undefined;
    });
    call.on('finish', () => {
      // https://github.com/grpc/grpc-node/issues/2681#issuecomment-1989715667
      // Versions of grpc-js 1.10.0 and 1.10.1 will not operate correctly with gRPC-JS
      // and may cause server-side streaming calls to always appear as if they were cancelled
      // even if the client did not cancel the call.
      maybeCancel.cancel = undefined;
    });
    call.on('cancelled', () => {
      maybeCancel.cancel?.();
      maybeCancel.cancel = undefined;
    });
  }

  let headerSent = false;

  const context = {
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

  return {context, maybeCancel};
}
