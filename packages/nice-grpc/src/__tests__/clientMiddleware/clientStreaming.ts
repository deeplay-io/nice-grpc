import getPort = require('get-port');
import {
  createChannel,
  createClientFactory,
  createServer,
  Metadata,
  ServerError,
  Status,
} from '../..';
import {TestService} from '../../../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../../../fixtures/test_pb';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';
import {throwUnimplemented} from '../utils/throwUnimplemented';

test('basic', async () => {
  const actions: any[] = [];
  let metadataValue: string | undefined;

  const server = createServer();

  server.add(TestService, {
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    async testClientStream(request: AsyncIterable<TestRequest>, context) {
      metadataValue = context.metadata.get('test');

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
  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(TestService, channel);

  const metadata = Metadata();
  metadata.set('test', 'test-metadata-value');

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    yield new TestRequest().setId('test-2');
  }

  await expect(
    client.testClientStream(createRequest(), {
      testOption: 'test-value',
      metadata,
    }),
  ).resolves.toMatchInlineSnapshot(`
            nice_grpc.test.TestResponse {
              "id": "test-1 test-2",
            }
          `);

  expect(metadataValue).toMatchInlineSnapshot(`"test-metadata-value"`);

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "options": Object {
          "testOption": "test-value",
        },
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

  const server = createServer();

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
  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(TestService, channel);

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    yield new TestRequest().setId('test-2');
  }

  await expect(
    client.testClientStream(createRequest(), {
      testOption: 'test-value',
    }),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestClientStream NOT_FOUND: test-1]`,
  );

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "options": Object {
          "testOption": "test-value",
        },
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
        "error": [ClientError: /nice_grpc.test.Test/TestClientStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
