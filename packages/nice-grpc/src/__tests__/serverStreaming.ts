import {delay, forever, isAbortError} from 'abort-controller-x';
import {
  Metadata,
  ServerError,
  Status,
  createChannel,
  createClient,
  createServer,
} from '..';
import {TestService} from '../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/grpc-js/test_pb';
import {throwUnimplemented} from './utils/throwUnimplemented';
import {defer} from './utils/defer';

/**
 * Tests that two streaming RPCs one after another work correctly. Specifically tests
 * that the server does not reuse the same AbortSignal for both RPCs.
 */
test('back-to-back', async () => {
  const server = createServer();

  const serverSignal1 = defer<AbortSignal>();
  const serverSignal2 = defer<AbortSignal>();
  const serverGeneratorFinalized1 = defer<void>();
  const serverGeneratorFinalized2 = defer<void>();

  let firstTimeOnly = true;

  server.add(TestService, {
    async *testServerStream(request: TestRequest, context) {
      const first = firstTimeOnly;
      firstTimeOnly = false;

      if (first) {
        serverSignal1.resolve(context.signal);
      } else {
        serverSignal2.resolve(context.signal);
      }

      try {
        let count = first ? 100 : 200;
        while (true) {
          yield new TestResponse().setId(`${request.getId()}-${count++}`);
        }
      } finally {
        if (first) {
          serverGeneratorFinalized1.resolve();
        } else {
          serverGeneratorFinalized2.resolve();
        }
      }
    },
    testUnary: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');
  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const it1 = client
    .testServerStream(new TestRequest().setId('first'))
    [Symbol.asyncIterator]();

  await expect(it1.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "first-100",
      },
    }
  `);
  const serverSig1 = await serverSignal1;
  expect(serverSig1.aborted).toBe(false);
  expect(serverGeneratorFinalized1.isResolved).toBe(false);

  await expect(it1.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "first-101",
      },
    }
  `);

  expect(serverSig1.aborted).toBe(false);
  await it1.return?.();
  await serverGeneratorFinalized1;
  expect(serverSig1.aborted).toBe(true);

  const it2 = client
    .testServerStream(new TestRequest().setId('second'))
    [Symbol.asyncIterator]();
  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "second-200",
      },
    }
  `);
  const serverSig2 = await serverSignal2;
  expect(serverSig2.aborted).toBe(false);
  expect(serverGeneratorFinalized2.isResolved).toBe(false);

  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "second-201",
      },
    }
  `);

  expect(serverSig2.aborted).toBe(false);
  await it2.return?.();
  await serverGeneratorFinalized2;
  expect(serverSig2.aborted).toBe(true);

  channel.close();
  await server.shutdown();
});

/**
 * Tests that two interleaved streaming RPCs work correctly. Specifically tests
 * that the server does not reuse the same AbortSignal for both RPCs and that
 * messages from both RPCs are routed correctly.
 */
test('interleaved', async () => {
  const server = createServer();

  const serverSignal1 = defer<AbortSignal>();
  const serverSignal2 = defer<AbortSignal>();
  const serverGeneratorFinalized1 = defer<void>();
  const serverGeneratorFinalized2 = defer<void>();

  let firstTimeOnly = true;

  server.add(TestService, {
    async *testServerStream(request: TestRequest, context) {
      const first = firstTimeOnly;
      firstTimeOnly = false;

      if (first) {
        serverSignal1.resolve(context.signal);
      } else {
        serverSignal2.resolve(context.signal);
      }

      try {
        let count = first ? 100 : 200;
        while (true) {
          yield new TestResponse().setId(`${request.getId()}-${count++}`);
        }
      } finally {
        if (first) {
          serverGeneratorFinalized1.resolve();
        } else {
          serverGeneratorFinalized2.resolve();
        }
      }
    },
    testUnary: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');
  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const it1 = client
    .testServerStream(new TestRequest().setId('first'))
    [Symbol.asyncIterator]();

  await expect(it1.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "first-100",
      },
    }
  `);
  const serverSig1 = await serverSignal1;
  expect(serverSig1.aborted).toBe(false);
  expect(serverGeneratorFinalized1.isResolved).toBe(false);

  await expect(it1.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "first-101",
      },
    }
  `);

  const it2 = client
    .testServerStream(new TestRequest().setId('second'))
    [Symbol.asyncIterator]();
  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "second-200",
      },
    }
  `);
  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "second-201",
      },
    }
  `);

  const serverSig2 = await serverSignal2;
  expect(serverSig1.aborted).toBe(false);
  expect(serverSig2.aborted).toBe(false);
  expect(serverGeneratorFinalized1.isResolved).toBe(false);
  expect(serverGeneratorFinalized2.isResolved).toBe(false);
  await expect(it1.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "first-102",
      },
    }
  `);
  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "second-202",
      },
    }
  `);

  expect(serverSig1.aborted).toBe(false);
  expect(serverGeneratorFinalized1.isResolved).toBe(false);
  await it1.return?.();
  await serverGeneratorFinalized1;
  expect(serverSig1.aborted).toBe(true);

  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": nice_grpc.test.TestResponse {
        "id": "second-203",
      },
    }
  `);

  expect(serverSig2.aborted).toBe(false);
  expect(serverGeneratorFinalized2.isResolved).toBe(false);
  await it2.return?.();
  await serverGeneratorFinalized2;
  expect(serverSig2.aborted).toBe(true);

  channel.close();
  await server.shutdown();
});

test('basic', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;

  server.add(TestService, {
    async *testServerStream(request: TestRequest, context) {
      serverSignal = context.signal;

      yield new TestResponse().setId(`${request.getId()}-1`);
      yield new TestResponse().setId(`${request.getId()}-2`);
    },
    testUnary: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const responses: any[] = [];

  for await (const response of client.testServerStream(
    new TestRequest().setId('test'),
  )) {
    responses.push(response);
  }

  expect(responses).toMatchInlineSnapshot(`
    [
      nice_grpc.test.TestResponse {
        "id": "test-1",
      },
      nice_grpc.test.TestResponse {
        "id": "test-2",
      },
    ]
  `);
  expect(serverSignal!.aborted).toBe(false);

  channel.close();

  await server.shutdown();
});

test('metadata', async () => {
  const server = createServer();

  const responseDeferred = defer<void>();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest, context) {
      const values = context.metadata.getAll('test');
      const binValues = context.metadata.getAll('test-bin');

      context.header.set('test', values);
      context.header.set('test-bin', binValues);

      context.sendHeader();

      await responseDeferred;

      context.trailer.set('test', values);
      context.trailer.set('test-bin', binValues);
    },
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

  const promise = Promise.resolve().then(async () => {
    const responses: any[] = [];

    const iterable = client.testServerStream(new TestRequest(), {
      metadata,
      onHeader(header) {
        headerDeferred.resolve(header);
      },
      onTrailer(trailer) {
        trailerDeferred.resolve(trailer);
      },
    });

    for await (const response of iterable) {
      responses.push(response);
    }

    return responses;
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

  responseDeferred.resolve();

  await expect(promise).resolves.toMatchInlineSnapshot(`[]`);

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
    async *testServerStream(request: TestRequest, context) {
      const values = context.metadata.getAll('test');

      context.header.set('test', values);
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const metadata = Metadata();
  metadata.set('test', ['test-value-1', 'test-value-2']);

  let header: Metadata | undefined;

  const iterable = client.testServerStream(new TestRequest(), {
    metadata,
    onHeader(header_) {
      header = header_;
    },
  });

  for await (const response of iterable) {
    expect(header?.getAll('test')).toMatchInlineSnapshot(`
      [
        "test-value-1, test-value-2",
      ]
    `);
  }

  channel.close();

  await server.shutdown();
});

test('server error', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  let serverGeneratorFinalized = false;

  server.add(TestService, {
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest, context) {
      try {
        serverSignal = context.signal;
        yield new TestResponse().setId(request.getId());

        context.trailer.set('test', 'test-value');
        throw new ServerError(Status.ABORTED, 'test');
      } finally {
        serverGeneratorFinalized = true;
      }
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const responses: any[] = [];
  let trailer: Metadata | undefined;

  try {
    for await (const response of client.testServerStream(
      new TestRequest().setId('test'),
      {
        onTrailer(metadata) {
          trailer = metadata;
        },
      },
    )) {
      responses.push({type: 'response', response: response});
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    [
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "response",
      },
      {
        "error": [ClientError: /nice_grpc.test.Test/TestServerStream ABORTED: test],
        "type": "error",
      },
    ]
  `);
  expect(serverSignal!.aborted).toBe(false);
  expect(serverGeneratorFinalized).toBe(true);

  expect(trailer?.getAll('test')).toMatchInlineSnapshot(`
    [
      "test-value",
    ]
  `);

  channel.close();

  await server.shutdown();
});

test('client cancel', async () => {
  const server = createServer();

  const serverAbortDeferred = defer<void>();
  let serverGeneratorFinalized = false;

  server.add(TestService, {
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest, {signal}) {
      yield new TestResponse().setId(request.getId());

      try {
        return await forever(signal);
      } catch (err) {
        if (isAbortError(err)) {
          serverAbortDeferred.resolve();
        }
        throw err;
      } finally {
        serverGeneratorFinalized = true;
      }
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const abortController = new AbortController();

  const iterable = client.testServerStream(new TestRequest().setId('test'), {
    signal: abortController.signal,
  });

  const responses: any[] = [];

  try {
    for await (const response of iterable) {
      responses.push({type: 'response', response: response});
      abortController.abort();
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    [
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "response",
      },
      {
        "error": [AbortError: The operation has been aborted],
        "type": "error",
      },
    ]
  `);

  await serverAbortDeferred;
  expect(serverGeneratorFinalized).toBe(true);

  channel.close();

  await server.shutdown();
});

test('high rate', async () => {
  const count = 10_000;

  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest) {
      for (let i = 0; i < count; i++) {
        yield new TestResponse().setId(`${i}`);
      }
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  let i = 0;

  for await (const response of client.testServerStream(new TestRequest())) {
    expect(response.getId()).toBe(`${i++}`);
  }

  expect(i).toBe(count);

  channel.close();

  await server.shutdown();
});

test('aborted iteration on client', async () => {
  const server = createServer();

  const serverAbortDeferred = defer<void>();
  let serverGeneratorFinalized = false;

  server.add(TestService, {
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest, {signal}) {
      yield new TestResponse().setId(request.getId());

      try {
        return await forever(signal);
      } catch (err) {
        if (isAbortError(err)) {
          serverAbortDeferred.resolve();
        }

        throw err;
      } finally {
        serverGeneratorFinalized = true;
      }
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const iterable = client.testServerStream(new TestRequest().setId('test'));

  const responses: any[] = [];

  try {
    for await (const response of iterable) {
      responses.push({type: 'response', response: response});

      throw new Error('test');
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    [
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "response",
      },
      {
        "error": [Error: test],
        "type": "error",
      },
    ]
  `);

  await serverAbortDeferred;
  expect(serverGeneratorFinalized).toBe(true);

  channel.close();

  await server.shutdown();
});

test('graceful server shutdown', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  let serverGeneratorFinalized = false;

  server.add(TestService, {
    async *testServerStream(request: TestRequest, context) {
      serverSignal = context.signal;

      try {
        yield new TestResponse().setId(`${request.getId()}-1`);
        await delay(context.signal, 200);
        yield new TestResponse().setId(`${request.getId()}-2`);
      } finally {
        serverGeneratorFinalized = true;
      }
    },
    testUnary: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const responses: any[] = [];
  let shutdownPromise: Promise<void> | undefined;
  for await (const response of client.testServerStream(
    new TestRequest().setId('test'),
  )) {
    responses.push(response);
    if (responses.length === 1) {
      shutdownPromise = server.shutdown();
    }
  }

  expect(responses).toMatchInlineSnapshot(`
    [
      nice_grpc.test.TestResponse {
        "id": "test-1",
      },
      nice_grpc.test.TestResponse {
        "id": "test-2",
      },
    ]
  `);
  await shutdownPromise;
  expect(serverSignal!.aborted).toBe(false);
  expect(serverGeneratorFinalized).toBe(true);

  channel.close();

  await server.shutdown();
});

test('force server shutdown', async () => {
  const server = createServer();

  let serverSignal: AbortSignal;
  let serverGeneratorFinalized = defer<void>();

  server.add(TestService, {
    async *testServerStream(request: TestRequest, context) {
      serverSignal = context.signal;

      try {
        yield new TestResponse().setId(`${request.getId()}-1`);
        await delay(context.signal, 200);
        yield new TestResponse().setId(`${request.getId()}-2`);
      } finally {
        serverGeneratorFinalized.resolve();
      }
    },
    testUnary: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  const responses: any[] = [];

  try {
    for await (const response of client.testServerStream(
      new TestRequest().setId('test'),
    )) {
      responses.push(response);
      if (responses.length === 1) {
        server.forceShutdown();
      }
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    [
      nice_grpc.test.TestResponse {
        "id": "test-1",
      },
      {
        "error": [ClientError: /nice_grpc.test.Test/TestServerStream CANCELLED: Call cancelled],
        "type": "error",
      },
    ]
  `);

  await serverGeneratorFinalized;
  expect(serverSignal!.aborted).toBe(true);

  channel.close();

  await server.shutdown();
});
