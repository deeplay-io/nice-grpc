import getPort = require('get-port');
import defer = require('defer-promise');
import {forever, isAbortError} from 'abort-controller-x';
import {createServer, ServerError} from 'nice-grpc';
import {createChannel, createClient, Metadata, Status} from '..';
import {TestService} from '../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/grpc-js/test_pb';
import {Test} from '../../fixtures/grpc-web/test_pb_service';
import {startGrpcWebProxy} from './utils/grpcwebproxy';
import {throwUnimplemented} from './utils/throwUnimplemented';
import {WebsocketTransport} from './utils/WebsocketTransport';

test('basic', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>) {
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

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );
  const client = createClient(Test, channel);

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

  proxy.stop();
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

      context.header.set('test', values);

      context.sendHeader();

      const response = await responseDeferred.promise;

      context.trailer.set('test', values);

      return response;
    },
    testBidiStream: throwUnimplemented,
  });

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );
  const client = createClient(Test, channel);

  const headerDeferred = defer<Metadata>();
  const trailerDeferred = defer<Metadata>();

  const metadata = Metadata();
  metadata.append('test', 'test-value-1');
  metadata.append('test', 'test-value-2');

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

  await expect(headerDeferred.promise.then(header => header.getAll('test')))
    .resolves.toMatchInlineSnapshot(`
          Array [
            "test-value-1, test-value-2",
          ]
        `);

  responseDeferred.resolve(new TestResponse());

  await expect(trailerDeferred.promise.then(header => header.getAll('test')))
    .resolves.toMatchInlineSnapshot(`
          Array [
            "test-value-1, test-value-2",
          ]
        `);

  proxy.stop();
  await server.shutdown();
});

test('error', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      context.trailer.set('test', ['test-value-1', 'test-value-2']);

      for await (const item of request) {
        throw new ServerError(Status.NOT_FOUND, item.getId());
      }

      return new TestResponse();
    },
    testBidiStream: throwUnimplemented,
  });

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );
  const client = createClient(Test, channel);

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

  await requestIterableFinish.promise;

  expect(trailer?.getAll('test')).toMatchInlineSnapshot(`
    Array [
      "test-value-1, test-value-2",
    ]
  `);

  proxy.stop();
  await server.shutdown();
});

test('cancel', async () => {
  const server = createServer();

  const serverRequestStartDeferred = defer<void>();
  const serverAbortDeferred = defer<void>();

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
      }
    },
    testBidiStream: throwUnimplemented,
  });

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );
  const client = createClient(Test, channel);

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

  await serverRequestStartDeferred.promise;

  abortController.abort();

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[AbortError: The operation has been aborted]`,
  );

  await serverAbortDeferred.promise;

  await requestIterableFinish.promise;

  proxy.stop();
  await server.shutdown();
});

test('early response', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>) {
      for await (const item of request) {
        return new TestResponse().setId(item.getId());
      }

      return new TestResponse();
    },
    testBidiStream: throwUnimplemented,
  });

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );
  const client = createClient(Test, channel);

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

  await requestIterableFinish.promise;

  proxy.stop();
  await server.shutdown();
});

test('request iterable error', async () => {
  const server = createServer();

  const serverRequestStartDeferred = defer<void>();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>) {
      for await (const _ of request) {
        serverRequestStartDeferred.resolve();
      }
      return new TestResponse();
    },
    testBidiStream: throwUnimplemented,
  });

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );
  const client = createClient(Test, channel);

  async function* createRequest() {
    yield new TestRequest().setId('test-1');

    await serverRequestStartDeferred.promise;

    throw new Error('test');
  }

  await expect(
    client.testClientStream(createRequest()),
  ).rejects.toMatchInlineSnapshot(`[Error: test]`);

  proxy.stop();
  await server.shutdown();
});
