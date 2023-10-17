import {forever} from 'abort-controller-x';
import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {deadlineMiddleware} from '.';
import {TestService} from '../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../fixtures/test_pb';

function throwUnimplemented(): never {
  throw new ServerError(Status.UNIMPLEMENTED, '');
}

test('successful call', async () => {
  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, {signal}) {
      return new TestResponse();
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

  const promise = client.testUnary(new TestRequest(), {
    deadline: new Date(Date.now() + 500),
  });

  await expect(promise).resolves.toEqual(new TestResponse());

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

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

  const promise = client.testUnary(new TestRequest(), {
    deadline: new Date(Date.now() + 250),
  });

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary DEADLINE_EXCEEDED: Deadline exceeded]`,
  );

  channel.close();

  await server.shutdown();
});

test('relative deadline', async () => {
  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, {signal}) {
      return await forever(signal);
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClientFactory()
    .use(deadlineMiddleware)
    .create(TestService, channel);

  const promise = client.testUnary(new TestRequest(), {
    deadline: 250,
  });

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary DEADLINE_EXCEEDED: Deadline exceeded]`,
  );

  channel.close();

  await server.shutdown();
});
