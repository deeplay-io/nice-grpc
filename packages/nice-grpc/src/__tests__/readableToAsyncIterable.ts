import {test, expect} from 'vitest';
import {isAbortError} from 'abort-controller-x';
import {Readable} from 'stream';
import {readableToAsyncIterable} from '../utils/readableToAsyncIterable';

test('throws AbortError with original error as cause when stream errors after signal aborted', async () => {
  const ac = new AbortController();

  const stream = new Readable({objectMode: true, read() {}});

  const iterationPromise = (async () => {
    for await (const _ of readableToAsyncIterable(stream as any, ac.signal)) {
      // not expected to yield anything
    }
  })();

  // Simulate: grpc-js emits 'cancelled' first (signal aborted), then 'error' on the stream
  ac.abort();
  const grpcError = Object.assign(new Error('The operation was cancelled'), {
    code: 1,
  });
  stream.destroy(grpcError);

  await expect(iterationPromise).rejects.toSatisfy(isAbortError);

  const thrown = await iterationPromise.catch(err => err);
  expect(thrown.cause).toBe(grpcError);
});

test('still throws the original error when stream errors without signal being aborted', async () => {
  const ac = new AbortController();

  const stream = new Readable({objectMode: true, read() {}});

  const iterationPromise = (async () => {
    for await (const _ of readableToAsyncIterable(stream as any, ac.signal)) {
      // not expected to yield anything
    }
  })();

  const originalError = new Error('unexpected stream error');
  stream.destroy(originalError);

  await expect(iterationPromise).rejects.toBe(originalError);
});
