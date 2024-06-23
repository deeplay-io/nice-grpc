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
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest, context) {
      contextTestValue = context.test;
      yield new TestResponse().setId(`${request.getId()}-0`);
      yield new TestResponse().setId(`${request.getId()}-1`);
    },
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
        "id": "test-0",
      },
      nice_grpc.test.TestResponse {
        "id": "test-1",
      },
    ]
  `);

  expect(contextTestValue).toBe('test-value');
  expect(actions).toMatchInlineSnapshot(`
    [
      {
        "requestStream": false,
        "responseStream": true,
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
          "id": "test-0",
        },
        "type": "response",
      },
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test-1",
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
    testUnary: throwUnimplemented,
    async *testServerStream(request: TestRequest) {
      yield new TestResponse().setId(`${request.getId()}-0`);
      throw new ServerError(Status.NOT_FOUND, `${request.getId()}-1`);
    },
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
      responses.push({type: 'response', response});
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    [
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test-0",
        },
        "type": "response",
      },
      {
        "error": [ClientError: /nice_grpc.test.Test/TestServerStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  expect(actions).toMatchInlineSnapshot(`
    [
      {
        "requestStream": false,
        "responseStream": true,
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
          "id": "test-0",
        },
        "type": "response",
      },
      {
        "error": [ServerError: NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
