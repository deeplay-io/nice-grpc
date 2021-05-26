import {Metadata, status} from '@grpc/grpc-js';
import AbortController from 'node-abort-controller';
import {TestService} from '../../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/test_pb';
import {createChannel} from '../client/channel';
import {createClient} from '../client/ClientFactory';
import {createServer} from '../server/Server';
import {ServerError} from '../server/ServerError';
import getPort = require('get-port');
import defer = require('defer-promise');
import {forever, isAbortError} from 'abort-controller-x';
import {throwUnimplemented} from './utils/throwUnimplemented';

test('basic', async () => {
  const server = createServer();

  server.add(TestService, {
    async *testServerStream(request: TestRequest, context) {
      yield new TestResponse().setId(`${request.getId()}-1`);
      yield new TestResponse().setId(`${request.getId()}-2`);
    },
    testUnary: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  const responses: any[] = [];

  for await (const response of client.testServerStream(
    new TestRequest().setId('test'),
  )) {
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
    async *testServerStream(request: TestRequest, context) {
      const values = context.metadata.get('test');

      for (const value of values) {
        context.header.add('test', value);
      }

      context.sendHeader();

      await responseDeferred.promise;

      for (const value of values) {
        context.trailer.set('test', value);
      }
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  const headerDeferred = defer<Metadata>();
  const trailerDeferred = defer<Metadata>();

  const metadata = new Metadata();
  metadata.add('test', 'test-value-1');
  metadata.add('test', 'test-value-2');

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

  await expect(headerDeferred.promise.then(header => header.get('test')))
    .resolves.toMatchInlineSnapshot(`
          Array [
            "test-value-1, test-value-2",
          ]
        `);

  responseDeferred.resolve();

  await expect(promise).resolves.toMatchInlineSnapshot(`Array []`);

  await expect(trailerDeferred.promise.then(header => header.get('test')))
    .resolves.toMatchInlineSnapshot(`
          Array [
            "test-value-1, test-value-2",
          ]
        `);

  channel.close();

  await server.shutdown();
});

test('error', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest, context) {
      yield new TestResponse().setId(request.getId());

      context.trailer.set('test', 'test-value');
      throw new ServerError(status.ABORTED, 'test');
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
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
    Array [
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "response",
      },
      Object {
        "error": [ClientError: /nice_grpc.test.Test/TestServerStream ABORTED: test],
        "type": "error",
      },
    ]
  `);

  expect(trailer?.get('test')).toMatchInlineSnapshot(`
    Array [
      "test-value",
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
    async *testServerStream(request: TestRequest, {signal}) {
      yield new TestResponse().setId(request.getId());

      try {
        return await forever(signal);
      } catch (err) {
        if (isAbortError(err)) {
          serverAbortDeferred.resolve();
        }

        throw err;
      }
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
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
    Array [
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
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

  channel.close();

  await server.shutdown();
});

test('deadline', async () => {
  const server = createServer();

  const serverAbortDeferred = defer<void>();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest, {signal}) {
      try {
        return await forever(signal);
      } catch (err) {
        if (isAbortError(err)) {
          serverAbortDeferred.resolve();
        }

        throw err;
      }
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  const promise = Promise.resolve().then(async () => {
    const responses: any[] = [];
    const iterable = client.testServerStream(new TestRequest(), {
      deadline: new Date(Date.now() + 100),
    });

    for await (const response of iterable) {
      responses.push(response);
    }

    return responses;
  });

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestServerStream DEADLINE_EXCEEDED: Deadline exceeded]`,
  );

  await serverAbortDeferred.promise;

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

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
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
      }
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
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
    Array [
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "response",
      },
      Object {
        "error": [Error: test],
        "type": "error",
      },
    ]
  `);

  await serverAbortDeferred.promise;

  channel.close();

  await server.shutdown();
});
