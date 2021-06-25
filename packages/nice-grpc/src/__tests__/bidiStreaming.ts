import getPort = require('get-port');
import defer = require('defer-promise');
import {forever, isAbortError} from 'abort-controller-x';
import AbortController from 'node-abort-controller';
import {
  createChannel,
  createClient,
  createServer,
  Metadata,
  ServerError,
  Status,
} from '..';
import {TestService} from '../../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/test_pb';
import {throwUnimplemented} from './utils/throwUnimplemented';

test('basic', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>) {
      for await (const req of request) {
        yield new TestResponse().setId(req.getId());
      }
    },
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    yield new TestRequest().setId('test-2');
  }

  const responses: any[] = [];

  for await (const response of client.testBidiStream(createRequest())) {
    responses.push(response);
  }

  expect(responses).toMatchInlineSnapshot(`
    Array [
      nice_grpc.test.TestResponse {
        "id": "test-1",
      },
      nice_grpc.test.TestResponse {
        "id": "test-2",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});

test('metadata', async () => {
  const server = createServer();

  const responseDeferred = defer<void>();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>, context) {
      const values = context.metadata.getAll('test');
      const binValues = context.metadata.getAll('test-bin');

      context.header.set('test', values);
      context.header.set('test-bin', binValues);

      context.sendHeader();

      await responseDeferred.promise;

      context.trailer.set('test', values);
      context.trailer.set('test-bin', binValues);
    },
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  const headerDeferred = defer<Metadata>();
  const trailerDeferred = defer<Metadata>();

  const metadata = Metadata();
  metadata.set('test', ['test-value-1', 'test-value-2']);
  metadata.set('test-bin', [new Uint8Array([1]), new Uint8Array([2])]);

  async function* createRequest() {
    yield new TestRequest();
  }

  const promise = Promise.resolve().then(async () => {
    const responses: any[] = [];

    const iterable = client.testBidiStream(createRequest(), {
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

  await expect(headerDeferred.promise.then(header => header.getAll('test')))
    .resolves.toMatchInlineSnapshot(`
          Array [
            "test-value-1, test-value-2",
          ]
        `);
  await expect(headerDeferred.promise.then(header => header.getAll('test-bin')))
    .resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "data": Array [
                1,
              ],
              "type": "Buffer",
            },
            Object {
              "data": Array [
                2,
              ],
              "type": "Buffer",
            },
          ]
        `);

  responseDeferred.resolve();

  await expect(promise).resolves.toMatchInlineSnapshot(`Array []`);

  await expect(trailerDeferred.promise.then(header => header.getAll('test')))
    .resolves.toMatchInlineSnapshot(`
          Array [
            "test-value-1, test-value-2",
          ]
        `);
  await expect(
    trailerDeferred.promise.then(header => header.getAll('test-bin')),
  ).resolves.toMatchInlineSnapshot(`
                Array [
                  Object {
                    "data": Array [
                      1,
                    ],
                    "type": "Buffer",
                  },
                  Object {
                    "data": Array [
                      2,
                    ],
                    "type": "Buffer",
                  },
                ]
              `);

  channel.close();

  await server.shutdown();
});

test('error', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>, context) {
      context.trailer.set('test', ['test-value-1', 'test-value-2']);

      for await (const item of request) {
        throw new ServerError(Status.NOT_FOUND, item.getId());
      }
    },
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  const responses: any[] = [];
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

  try {
    for await (const response of client.testBidiStream(createRequest(), {
      onTrailer(metadata) {
        trailer = metadata;
      },
    })) {
      responses.push({type: 'response', response: response});
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    Array [
      Object {
        "error": [ClientError: /nice_grpc.test.Test/TestBidiStream NOT_FOUND: test-0],
        "type": "error",
      },
    ]
  `);

  await requestIterableFinish.promise;

  expect(trailer?.getAll('test')).toMatchInlineSnapshot(`
    Array [
      "test-value-1, test-value-2",
    ]
  `);

  channel.close();

  await server.shutdown();
});

test('cancel', async () => {
  const server = createServer();

  const serverAbortDeferred = defer<void>();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>, {signal}) {
      for await (const item of request) {
        yield new TestResponse().setId(item.getId());

        try {
          await forever(signal);
        } catch (err) {
          if (isAbortError(err)) {
            serverAbortDeferred.resolve();
          }

          throw err;
        }
      }
    },
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
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

  const iterable = client.testBidiStream(createRequest(), {
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

  abortController.abort();

  expect(responses).toMatchInlineSnapshot(`
    Array [
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test-0",
        },
        "type": "response",
      },
      Object {
        "error": [AbortError: The operation has been aborted],
        "type": "error",
      },
    ]
  `);

  await serverAbortDeferred.promise;

  await requestIterableFinish.promise;

  channel.close();

  await server.shutdown();
});

test('early response', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>) {
      for await (const item of request) {
        yield new TestResponse().setId(item.getId());
        return;
      }
    },
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
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

  const promise = Promise.resolve().then(async () => {
    const responses: any[] = [];
    const iterable = client.testBidiStream(createRequest());

    for await (const response of iterable) {
      responses.push(response);
    }

    return responses;
  });

  await expect(promise).resolves.toMatchInlineSnapshot(`
          Array [
            nice_grpc.test.TestResponse {
              "id": "test-0",
            },
          ]
        `);

  await requestIterableFinish.promise;

  channel.close();

  await server.shutdown();
});

test('request iterable error', async () => {
  const server = createServer();

  const serverRequestStartDeferred = defer<void>();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>) {
      for await (const _ of request) {
        serverRequestStartDeferred.resolve();
      }
    },
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  async function* createRequest() {
    yield new TestRequest().setId('test-1');

    await serverRequestStartDeferred.promise;

    throw new Error('test');
  }

  const promise = Promise.resolve().then(async () => {
    const responses: any[] = [];
    const iterable = client.testBidiStream(createRequest());

    for await (const response of iterable) {
      responses.push(response);
    }

    return responses;
  });

  await expect(promise).rejects.toMatchInlineSnapshot(`[Error: test]`);

  channel.close();

  await server.shutdown();
});
