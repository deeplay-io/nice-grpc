import defer = require('defer-promise');
import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {delay, forever} from 'abort-controller-x';
import {TestService} from '../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../fixtures/test_pb';
import {deadlineMiddleware} from '.';

function throwUnimplemented(): never {
  throw new ServerError(Status.UNIMPLEMENTED, '');
}

test('successful call', async () => {
  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, {signal}) {
      await delay(signal, 100);

      return new TestResponse();
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

  const promise = client.testUnary(new TestRequest(), {
    deadline: new Date(Date.now() + 200),
  });

  await expect(promise).resolves.toEqual(new TestResponse());

  channel.close();

  await server.shutdown();
});

test('unary', async () => {
  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, {signal}) {
      return await forever(signal);
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

  const promise = client.testUnary(new TestRequest(), {
    deadline: new Date(Date.now() + 100),
  });

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary DEADLINE_EXCEEDED: Deadline exceeded]`,
  );

  channel.close();

  await server.shutdown();
});

test('server streaming', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest, {signal}) {
      return await forever(signal);
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

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

  channel.close();

  await server.shutdown();
});

test('client streaming', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, {signal}) {
      return await forever(signal);
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

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
    deadline: new Date(Date.now() + 100),
  });

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestClientStream DEADLINE_EXCEEDED: Deadline exceeded]`,
  );

  await requestIterableFinish.promise;

  channel.close();

  await server.shutdown();
});

test('bidirectional streaming', async () => {
  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>, {signal}) {
      await forever(signal);
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

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
    const iterable = client.testBidiStream(createRequest(), {
      deadline: new Date(Date.now() + 100),
    });

    for await (const response of iterable) {
      responses.push(response);
    }

    return responses;
  });

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestBidiStream DEADLINE_EXCEEDED: Deadline exceeded]`,
  );

  await requestIterableFinish.promise;

  channel.close();

  await server.shutdown();
});

test('absolute deadline', async () => {
  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, {signal}) {
      return await forever(signal);
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

  const promise = client.testUnary(new TestRequest(), {
    deadline: 100,
  });

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary DEADLINE_EXCEEDED: Deadline exceeded]`,
  );

  channel.close();

  await server.shutdown();
});
