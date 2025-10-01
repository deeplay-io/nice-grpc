import {forever, isAbortError} from 'abort-controller-x';
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
import {defer} from './utils/defer';

test('basic', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      serverSignal = context.signal;

      const requests: TestRequest[] = [];

      for await (const req of request) {
        requests.push(req);
      }

      return new TestResponse().setId(
        requests.map(request => request.getId()).join(' '),
      );
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    yield new TestRequest().setId('test-2');
  }

  const res = await client.testClientStream(createRequest());

  expect(res).toMatchInlineSnapshot(`
    nice_grpc.test.TestResponse {
      "id": "test-1 test-2",
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
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      const values = context.metadata.getAll('test');
      const binValues = context.metadata.getAll('test-bin');

      context.header.set('test', values);
      context.header.set('test-bin', binValues);

      context.sendHeader();

      const response = await responseDeferred;

      context.trailer.set('test', values);
      context.trailer.set('test-bin', binValues);

      return response;
    },
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

  async function* createRequest() {
    yield new TestRequest();
  }

  client.testClientStream(createRequest(), {
    metadata,
    onHeader(header) {
      headerDeferred.resolve(header);
    },
    onTrailer(trailer) {
      trailerDeferred.resolve(trailer);
    },
  });

  await expect(headerDeferred.then(header => header.getAll('test'))).resolves
    .toMatchInlineSnapshot(`
    [
      "test-value-1, test-value-2",
    ]
  `);
  await expect(headerDeferred.then(header => header.getAll('test-bin')))
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

  await expect(trailerDeferred.then(header => header.getAll('test'))).resolves
    .toMatchInlineSnapshot(`
    [
      "test-value-1, test-value-2",
    ]
  `);
  await expect(trailerDeferred.then(header => header.getAll('test-bin')))
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

  channel.close();

  await server.shutdown();
});

test('implicit header sending', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      const values = context.metadata.getAll('test');

      context.header.set('test', values);

      const requests: TestRequest[] = [];

      for await (const req of request) {
        requests.push(req);
      }

      return new TestResponse().setId(
        requests.map(request => request.getId()).join(' '),
      );
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const metadata = Metadata();
  metadata.set('test', ['test-value-1', 'test-value-2']);

  let header: Metadata | undefined;

  async function* createRequest() {
    yield new TestRequest();
  }

  await client.testClientStream(createRequest(), {
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
  let serverCallFinalized = false;

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      serverSignal = context.signal;
      context.trailer.set('test', ['test-value-1', 'test-value-2']);

      try {
        for await (const item of request) {
          throw new ServerError(Status.NOT_FOUND, item.getId());
        }

        return new TestResponse();
      } finally {
        serverCallFinalized = true;
      }
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  let trailer: Metadata | undefined;

  const requestIterableFinish = defer<void>();

  async function* createRequest() {
    let i = 0;

    try {
      while (true) {
        yield new TestRequest().setId(`test-${i++}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (err) {
      requestIterableFinish.reject(err);
      throw err;
    } finally {
      requestIterableFinish.resolve();
    }
  }

  await expect(
    client.testClientStream(createRequest(), {
      onTrailer(metadata) {
        trailer = metadata;
      },
    }),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestClientStream NOT_FOUND: test-0]`,
  );

  await requestIterableFinish;

  expect(serverSignal!.aborted).toBe(false);
  expect(serverCallFinalized).toBe(true);

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
  let serverCallFinalized = false;
  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, {signal}) {
      serverRequestStartDeferred.resolve();

      try {
        return await forever(signal);
      } catch (err) {
        if (isAbortError(err)) {
          serverAbortDeferred.resolve();
        }

        throw err;
      } finally {
        serverCallFinalized = true;
      }
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const abortController = new AbortController();

  const requestIterableFinish = defer<void>();

  async function* createRequest() {
    let i = 0;

    try {
      while (true) {
        yield new TestRequest().setId(`test-${i++}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (err) {
      requestIterableFinish.reject(err);
      throw err;
    } finally {
      requestIterableFinish.resolve();
    }
  }

  const promise = client.testClientStream(createRequest(), {
    signal: abortController.signal,
  });

  await serverRequestStartDeferred;

  abortController.abort();

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[AbortError: The operation has been aborted]`,
  );

  await serverAbortDeferred;
  expect(serverCallFinalized).toBe(true);

  await requestIterableFinish;

  channel.close();

  await server.shutdown();
});

test('early response', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      serverSignal = context.signal;

      for await (const item of request) {
        return new TestResponse().setId(item.getId());
      }

      return new TestResponse();
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const requestIterableFinish = defer<void>();

  async function* createRequest() {
    let i = 0;

    try {
      while (true) {
        yield new TestRequest().setId(`test-${i++}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (err) {
      requestIterableFinish.reject(err);
      throw err;
    } finally {
      requestIterableFinish.resolve();
    }
  }

  const response = await client.testClientStream(createRequest());

  expect(response).toMatchInlineSnapshot(`
    nice_grpc.test.TestResponse {
      "id": "test-0",
    }
  `);

  await requestIterableFinish;

  expect(serverSignal!.aborted).toBe(false);

  channel.close();

  await server.shutdown();
});

test('request iterable error', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  const serverRequestStartDeferred = defer<void>();
  const serverCallFinalized = defer<void>();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      serverSignal = context.signal;

      try {
        for await (const _ of request) {
          serverRequestStartDeferred.resolve();
        }
        await forever(context.signal);
        return new TestResponse();
      } finally {
        serverCallFinalized.resolve();
      }
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  async function* createRequest() {
    yield new TestRequest().setId('test-1');

    await serverRequestStartDeferred;

    throw new Error('test');
  }

  await expect(
    client.testClientStream(createRequest()),
  ).rejects.toMatchInlineSnapshot(`[Error: test]`);

  await serverCallFinalized;
  expect(serverSignal!.aborted).toBe(true);

  channel.close();

  await server.shutdown();
});

test('graceful server shutdown', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  const serverRequestStartDeferred = defer<void>();
  let serverGeneratorFinalized = false;

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      serverSignal = context.signal;
      serverRequestStartDeferred.resolve();
      const requests: TestRequest[] = [];

      try {
        for await (const req of request) {
          requests.push(req);
        }

        return new TestResponse().setId(
          requests.map(request => request.getId()).join(' '),
        );
      } finally {
        serverGeneratorFinalized = true;
      }
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  let shutdownPromise: Promise<void> | undefined;

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    await serverRequestStartDeferred;
    shutdownPromise = server.shutdown();
    yield new TestRequest().setId('test-2');
  }

  const res = await client.testClientStream(createRequest());

  expect(res).toMatchInlineSnapshot(`
    nice_grpc.test.TestResponse {
      "id": "test-1 test-2",
    }
  `);
  await shutdownPromise;
  expect(serverSignal!.aborted).toBe(false);
  expect(serverGeneratorFinalized).toBe(true);

  channel.close();
});

test('force server shutdown', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  const serverRequestStartDeferred = defer<void>();
  let serverGeneratorFinalized = false;

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      serverSignal = context.signal;
      serverRequestStartDeferred.resolve();
      const requests: TestRequest[] = [];

      try {
        for await (const req of request) {
          requests.push(req);
        }

        return new TestResponse().setId(
          requests.map(request => request.getId()).join(' '),
        );
      } finally {
        serverGeneratorFinalized = true;
      }
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  let clientIteratorFinalized = defer<void>();

  async function* createRequest() {
    try {
      yield new TestRequest().setId('test-1');
      await serverRequestStartDeferred;
      server.forceShutdown();
      yield new TestRequest().setId('test-2');
    } finally {
      clientIteratorFinalized.resolve();
    }
  }

  await expect(
    client.testClientStream(createRequest()),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestClientStream CANCELLED: Call cancelled]`,
  );

  await clientIteratorFinalized;
  expect(serverSignal!.aborted).toBe(true);
  expect(serverGeneratorFinalized).toBe(true);

  channel.close();
});
