import {test, expect} from 'vitest';
import {createChannel, createClient, createServer} from '..';

// A minimal protobuf service whose request and response are empty messages.
const message = {
  requestSerialize: () => Buffer.alloc(0),
  requestDeserialize: () => ({}),
  responseSerialize: () => Buffer.alloc(0),
  responseDeserialize: () => ({}),
};
const definition = {
  serverStream: {
    ...message,
    path: '/test.PreAbortedStreaming/ServerStream',
    requestStream: false,
    responseStream: true,
  },
  bidi: {
    ...message,
    path: '/test.PreAbortedStreaming/Bidi',
    requestStream: true,
    responseStream: true,
  },
} as const;

test.each([
  ['serverStream', true],
  ['serverStream', false],
  ['bidi', true],
  ['bidi', false],
] as const)(
  '%s aborts before starting an RPC (abort before call: %s)',
  async (method, abortBeforeCall) => {
    const server = createServer();
    let serverCalled = false;
    let requestConsumed = false;

    server.add(definition, {
      async *serverStream() {
        serverCalled = true;
        yield {};
      },
      async *bidi(requests) {
        serverCalled = true;
        for await (const request of requests) {
          yield request;
        }
      },
    });

    const port = await server.listen('127.0.0.1:0');
    const channel = createChannel(`127.0.0.1:${port}`);
    const client = createClient(definition, channel);
    const abortController = new AbortController();
    if (abortBeforeCall) {
      abortController.abort();
    }

    async function* requests() {
      requestConsumed = true;
      yield {};
    }

    try {
      const responses =
        method === 'serverStream'
          ? client.serverStream({}, {signal: abortController.signal})
          : client.bidi(requests(), {signal: abortController.signal});

      if (!abortBeforeCall) {
        abortController.abort();
      }

      await expect(
        responses[Symbol.asyncIterator]().next(),
      ).rejects.toMatchObject({name: 'AbortError'});
      expect(serverCalled).toBe(false);
      expect(requestConsumed).toBe(false);
    } finally {
      channel.close();
      await server.shutdown();
    }
  },
);
