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
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      contextTestValue = context.test;

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

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    yield new TestRequest().setId('test-2');
  }

  await expect(client.testClientStream(createRequest())).resolves
    .toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test-1 test-2",
          }
        `);

  expect(contextTestValue).toBe('test-value');
  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "requestStream": true,
        "responseStream": false,
        "type": "start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test-1",
        },
        "type": "request",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test-2",
        },
        "type": "request",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test-1 test-2",
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
    async testClientStream(request: AsyncIterable<TestRequest>) {
      for await (const item of request) {
        throw new ServerError(Status.NOT_FOUND, item.getId());
      }

      return new TestResponse();
    },
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    yield new TestRequest().setId('test-2');
  }

  await expect(
    client.testClientStream(createRequest()),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestClientStream NOT_FOUND: test-1]`,
  );

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "requestStream": true,
        "responseStream": false,
        "type": "start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test-1",
        },
        "type": "request",
      },
      Object {
        "error": [ServerError: NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
