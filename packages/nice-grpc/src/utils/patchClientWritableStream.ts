import {ClientWritableStream} from '@grpc/grpc-js';
import {Http2CallStream} from '@grpc/grpc-js/build/src/call-stream';
import {ClientHttp2Stream} from 'http2';

/**
 * Workaround for https://github.com/grpc/grpc-node/issues/1094
 *
 * @internal
 */
export function patchClientWritableStream(
  stream: ClientWritableStream<any>,
): void {
  const http2CallStream = (stream.call as any).call as Http2CallStream;

  const origAttachHttp2Stream = http2CallStream.attachHttp2Stream;
  http2CallStream.attachHttp2Stream = function patchAttachHttp2Stream(
    stream,
    ...rest
  ) {
    const origWrite = stream.write;

    stream.write = function patchedWrite(
      this: ClientHttp2Stream,
      ...args: any
    ) {
      if (this.writableEnded) {
        return true;
      }

      return origWrite.apply(this, args);
    };

    return origAttachHttp2Stream.call(this, stream, ...rest);
  };
}
