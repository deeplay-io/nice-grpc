import {ObjectReadable} from '@grpc/grpc-js/build/src/object-stream';

/**
 * This is a copy of NodeJS createAsyncIterator(stream), with removed stream
 * destruction.
 *
 * https://github.com/nodejs/node/blob/v15.8.0/lib/internal/streams/readable.js#L1079
 *
 * @internal
 */
export async function* readableToAsyncIterable<T>(
  stream: ObjectReadable<T>,
): AsyncIterable<T> {
  let callback = nop;

  function next(this: any, resolve?: any) {
    if (this === stream) {
      callback();
      callback = nop;
    } else {
      callback = resolve;
    }
  }

  const state = (stream as any)._readableState;

  let error = state.errored;
  let errorEmitted = state.errorEmitted;
  let endEmitted = state.endEmitted;
  let closeEmitted = state.closeEmitted;

  stream
    .on('readable', next)
    .on('error', function (this: any, err) {
      error = err;
      errorEmitted = true;
      next.call(this);
    })
    .on('end', function (this: any) {
      endEmitted = true;
      next.call(this);
    })
    .on('close', function (this: any) {
      closeEmitted = true;
      next.call(this);
    });

  while (true) {
    const chunk = stream.destroyed ? null : stream.read();
    if (chunk !== null) {
      yield chunk;
    } else if (errorEmitted) {
      throw error;
    } else if (endEmitted) {
      break;
    } else if (closeEmitted) {
      break;
    } else {
      await new Promise(next);
    }
  }
}

const nop = () => {};
