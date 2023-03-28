import {Metadata} from 'nice-grpc-common';
import {concatBuffers} from '../utils/concatBuffers';
import {decodeMetadata} from './decodeMetadata';
import {LPM_HEADER_LENGTH, ParsedLpmHeader, parseLpmHeader} from './framing';
import {Frame} from './Transport';

/** @internal */
export type DecodeResponseParams<T> = {
  response: AsyncIterable<Frame>;
  decode(data: Uint8Array): T;
  onHeader(header: Metadata): void;
  onTrailer(trailer: Metadata): void;
};

/** @internal */
export async function* decodeResponse<T>({
  response,
  decode,
  onHeader,
  onTrailer,
}: DecodeResponseParams<T>): AsyncIterable<T> {
  let receivedHeader = false;
  let receivedTrailer = false;
  let receivedData = false;

  type ChunkBuffer = {
    chunks: Uint8Array[];
    totalLength: number;
    targetLength: number;
  };

  let buffer: ChunkBuffer = createChunkBuffer(LPM_HEADER_LENGTH);
  let lpmHeader: ParsedLpmHeader | undefined;

  for await (const frame of response) {
    if (frame.type === 'header') {
      handleHeader(frame.header);
    } else if (frame.type === 'trailer') {
      handleTrailer(frame.trailer);
    } else if (frame.type === 'data') {
      if (receivedTrailer) {
        throw new Error('Received data after trailer');
      }

      let {data} = frame;

      while (data.length > 0 || lpmHeader?.length === 0) {
        const position = Math.min(
          data.length,
          buffer.targetLength - buffer.totalLength,
        );

        const chunk = data.subarray(0, position);
        data = data.subarray(position);

        buffer.chunks.push(chunk);
        buffer.totalLength += chunk.length;

        if (buffer.totalLength === buffer.targetLength) {
          const messageBytes = concatBuffers(buffer.chunks, buffer.totalLength);

          if (lpmHeader == null) {
            lpmHeader = parseLpmHeader(messageBytes);
            buffer = createChunkBuffer(lpmHeader.length);
          } else {
            if (lpmHeader.compressed) {
              throw new Error('Compressed messages not supported');
            }

            if (lpmHeader.isMetadata) {
              if (!receivedHeader) {
                handleHeader(decodeMetadata(messageBytes));
              } else {
                handleTrailer(decodeMetadata(messageBytes));
              }
            } else {
              if (!receivedHeader) {
                throw new Error('Received data before header');
              }

              yield decode(messageBytes);

              receivedData = true;
            }

            lpmHeader = undefined;
            buffer = createChunkBuffer(LPM_HEADER_LENGTH);
          }
        }
      }
    }
  }

  function handleHeader(header: Metadata) {
    if (receivedHeader) {
      throw new Error('Received multiple headers');
    }

    if (receivedData) {
      throw new Error('Received header after data');
    }

    if (receivedTrailer) {
      throw new Error('Received header after trailer');
    }

    receivedHeader = true;

    onHeader(header);
  }

  function handleTrailer(trailer: Metadata) {
    if (receivedTrailer) {
      throw new Error('Received multiple trailers');
    }

    receivedTrailer = true;

    onTrailer(trailer);
  }

  function createChunkBuffer(targetLength: number): ChunkBuffer {
    return {
      chunks: [],
      totalLength: 0,
      targetLength,
    };
  }
}
