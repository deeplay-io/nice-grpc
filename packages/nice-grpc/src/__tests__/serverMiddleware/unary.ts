import {
  createChannel,
  createClient,
  createServer,
  ServerError,
  Status,
} from '../..';
import {TestService} from '../../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../../fixtures/grpc-js/test_pb';
import {createTestServerMiddleware} from '../utils/testServerMiddleware';
import {throwUnimplemented} from '../utils/throwUnimplemented';

test('basic', async () => {
  const actions: any[] = [];

  let contextTestValue: any;

  const server = createServer().use(
    createTestServerMiddleware({test: 'test-value'}, actions),
  );

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      contextTestValue = context.test;
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

  expect(contextTestValue).toBe('test-value');
  expect(actions).toMatchInlineSnapshot(`
    [
      {
        "requestStream": false,
        "responseStream": false,
        "type": "start",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "request",
      },
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "response",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});

test('error', async () => {
  const actions: any[] = [];

  const server = createServer().use(
    createTestServerMiddleware({test: 'test-value'}, actions),
  );

  server.add(TestService, {
    async testUnary(request: TestRequest) {
      throw new ServerError(Status.NOT_FOUND, request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(TestService, channel);

  await expect(
    client.testUnary(new TestRequest().setId('test')),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary NOT_FOUND: test]`,
  );

  expect(actions).toMatchInlineSnapshot(`
    [
      {
        "requestStream": false,
        "responseStream": false,
        "type": "start",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "request",
      },
      {
        "error": [ServerError: NOT_FOUND: test],
        "type": "error",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
