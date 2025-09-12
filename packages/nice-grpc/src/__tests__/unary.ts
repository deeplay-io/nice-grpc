import defer = require('defer-promise');
import {forever, delay, isAbortError} from 'abort-controller-x';
import {
  createChannel,
  createClient,
  createServer,
  Metadata,
  ServerError,
  Status,
} from '..';
import {TestService} from '../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/grpc-js/test_pb';
import {throwUnimplemented} from './utils/throwUnimplemented';
import {connectivityState} from '@grpc/grpc-js';

test('basic', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      serverSignal = context.signal;

      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  await expect(client.testUnary(new TestRequest().setId('test'))).resolves
    .toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test",
          }
        `);
  expect(serverSignal!.aborted).toBe(false);

  channel.close();

  await server.shutdown();
});

test('metadata', async () => {
  const server = createServer();

  const responseDeferred = defer<TestResponse>();

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      const values = context.metadata.getAll('test');
      const binValues = context.metadata.getAll('test-bin');

      context.header.set('test', values);
      context.header.set('test-bin', binValues);

      context.sendHeader();

      const response = await responseDeferred.promise;

      context.trailer.set('test', values);
      context.trailer.set('test-bin', binValues);

      return response;
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const headerDeferred = defer<Metadata>();
  const trailerDeferred = defer<Metadata>();

  const metadata = Metadata();
  metadata.set('test', ['test-value-1', 'test-value-2']);
  metadata.set('test-bin', [new Uint8Array([1]), new Uint8Array([2])]);

  client.testUnary(new TestRequest(), {
    metadata,
    onHeader(header) {
      headerDeferred.resolve(header);
    },
    onTrailer(trailer) {
      trailerDeferred.resolve(trailer);
    },
  });

  await expect(headerDeferred.promise.then(header => header.getAll('test')))
    .resolves.toMatchInlineSnapshot(`
    [
      "test-value-1, test-value-2",
    ]
  `);
  await expect(headerDeferred.promise.then(header => header.getAll('test-bin')))
    .resolves.toMatchInlineSnapshot(`
    [
      {
        "data": [
          1,
        ],
        "type": "Buffer",
      },
      {
        "data": [
          2,
        ],
        "type": "Buffer",
      },
    ]
  `);

  responseDeferred.resolve(new TestResponse());

  await expect(trailerDeferred.promise.then(header => header.getAll('test')))
    .resolves.toMatchInlineSnapshot(`
    [
      "test-value-1, test-value-2",
    ]
  `);
  await expect(
    trailerDeferred.promise.then(header => header.getAll('test-bin')),
  ).resolves.toMatchInlineSnapshot(`
    [
      {
        "data": [
          1,
        ],
        "type": "Buffer",
      },
      {
        "data": [
          2,
        ],
        "type": "Buffer",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});

test('implicit header sending', async () => {
  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      const values = context.metadata.getAll('test');

      context.header.set('test', values);

      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const metadata = Metadata();
  metadata.set('test', ['test-value-1', 'test-value-2']);

  let header: Metadata | undefined;

  await client.testUnary(new TestRequest(), {
    metadata,
    onHeader(header_) {
      header = header_;
    },
  });

  expect(header?.getAll('test')).toMatchInlineSnapshot(`
    [
      "test-value-1, test-value-2",
    ]
  `);

  channel.close();

  await server.shutdown();
});

test('server error', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      serverSignal = context.signal;
      context.trailer.set('test', ['test-value-1', 'test-value-2']);
      throw new ServerError(Status.NOT_FOUND, request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  let trailer: Metadata | undefined;

  await expect(
    client.testUnary(new TestRequest().setId('test'), {
      onTrailer(metadata) {
        trailer = metadata;
      },
    }),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary NOT_FOUND: test]`,
  );
  expect(serverSignal!.aborted).toBe(false);

  expect(trailer?.getAll('test')).toMatchInlineSnapshot(`
    [
      "test-value-1, test-value-2",
    ]
  `);

  channel.close();

  await server.shutdown();
});

test('client cancel', async () => {
  const server = createServer();

  const serverRequestStartDeferred = defer<void>();
  const serverAbortDeferred = defer<void>();

  server.add(TestService, {
    async testUnary(request: TestRequest, {signal}) {
      serverRequestStartDeferred.resolve();

      try {
        return await forever(signal);
      } catch (err) {
        if (isAbortError(err)) {
          serverAbortDeferred.resolve();
        }

        throw err;
      }
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const abortController = new AbortController();

  const promise = client.testUnary(new TestRequest(), {
    signal: abortController.signal,
  });

  await serverRequestStartDeferred.promise;

  abortController.abort();

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[AbortError: The operation has been aborted]`,
  );

  await serverAbortDeferred.promise;

  channel.close();

  await server.shutdown();
});

test('channel close', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  const serverRequestStartDeferred = defer<void>();

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      serverSignal = context.signal;
      serverRequestStartDeferred.resolve();

      await delay(context.signal, 200);

      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const promise = client.testUnary(new TestRequest().setId('test'));

  // close the channel after the unary call already reached the server
  await serverRequestStartDeferred.promise;
  channel.close();
  expect(channel.getConnectivityState(false)).toBe(connectivityState.SHUTDOWN);

  // closing channel does not affect already in-flight calls
  await expect(promise).resolves.toMatchInlineSnapshot(`
    nice_grpc.test.TestResponse {
      "id": "test",
    }
  `);
  expect(serverSignal!.aborted).toBe(false);

  // however, any new call on a closed channel will fail
  await expect(
    client.testUnary(new TestRequest().setId('test')),
  ).rejects.toMatchInlineSnapshot(`[Error: Channel has been shut down]`);

  await server.shutdown();
});

test('graceful server shutdown', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  const serverRequestStartDeferred = defer<void>();

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      serverSignal = context.signal;
      serverRequestStartDeferred.resolve();

      await delay(context.signal, 200);

      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const promise = client.testUnary(new TestRequest().setId('test'));

  // a graceful server shutdown should not affect already in-flight calls
  await serverRequestStartDeferred.promise;
  const shutdownPromise = server.shutdown();

  await expect(promise).resolves.toMatchInlineSnapshot(`
    nice_grpc.test.TestResponse {
      "id": "test",
    }
  `);
  await shutdownPromise;
  expect(serverSignal!.aborted).toBe(false);

  // however, any new call for a closed server will fail
  await expect(
    client.testUnary(new TestRequest().setId('test')),
  ).rejects.toThrow(
    '/nice_grpc.test.Test/TestUnary UNAVAILABLE: No connection established',
  );

  await server.shutdown();
});

test('force server shutdown', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  const serverRequestStartDeferred = defer<void>();

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      serverSignal = context.signal;
      serverRequestStartDeferred.resolve();

      await delay(context.signal, 200);

      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const promise = client.testUnary(new TestRequest().setId('test'));

  // a graceful server shutdown should not affect already in-flight calls
  await serverRequestStartDeferred.promise;
  server.forceShutdown();

  await expect(promise).rejects.toThrow(
    `/nice_grpc.test.Test/TestUnary CANCELLED: Call cancelled`,
  );
  // on going server methods should get aborted on force shutdown
  expect(serverSignal!.aborted).toBe(true);
});
