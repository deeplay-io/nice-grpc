import getPort = require('get-port');
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
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>, context) {
      contextTestValue = context.test;

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
    [
      nice_grpc.test.TestResponse {
        "id": "test-1",
      },
      nice_grpc.test.TestResponse {
        "id": "test-2",
      },
    ]
  `);

  expect(contextTestValue).toBe('test-value');
  expect(actions).toMatchInlineSnapshot(`
    [
      {
        "requestStream": true,
        "responseStream": true,
        "type": "start",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test-1",
        },
        "type": "request",
      },
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test-1",
        },
        "type": "response",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test-2",
        },
        "type": "request",
      },
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test-2",
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
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>) {
      for await (const item of request) {
        throw new ServerError(Status.NOT_FOUND, item.getId());
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

  try {
    for await (const response of client.testBidiStream(createRequest())) {
      responses.push({type: 'response', response});
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    [
      {
        "error": [ClientError: /nice_grpc.test.Test/TestBidiStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  expect(actions).toMatchInlineSnapshot(`
    [
      {
        "requestStream": true,
        "responseStream": true,
        "type": "start",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test-1",
        },
        "type": "request",
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
