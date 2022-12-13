import getPort = require('get-port');
import {createServer, ServerError} from 'nice-grpc';
import {createChannel, createClientFactory, Metadata, Status} from '../..';
import {TestService} from '../../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../../fixtures/grpc-js/test_pb';
import {Test} from '../../../fixtures/grpc-web/test_pb_service';
import {startGrpcWebProxy} from '../utils/grpcwebproxy';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';
import {throwUnimplemented} from '../utils/throwUnimplemented';
import {WebsocketTransport} from '../utils/WebsocketTransport';

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

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );

  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(Test, channel);

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
    [
      {
        "options": {
          "testOption": "test-value",
        },
        "requestStream": true,
        "responseStream": false,
        "type": "start",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test-1",
        },
        "type": "request",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test-2",
        },
        "type": "request",
      },
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test-1 test-2",
        },
        "type": "response",
      },
    ]
  `);

  proxy.stop();
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

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );

  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(Test, channel);

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
    [
      {
        "options": {
          "testOption": "test-value",
        },
        "requestStream": true,
        "responseStream": false,
        "type": "start",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test-1",
        },
        "type": "request",
      },
      {
        "request": nice_grpc.test.TestRequest {
          "id": "test-2",
        },
        "type": "request",
      },
      {
        "error": [ClientError: /nice_grpc.test.Test/TestClientStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  proxy.stop();
  await server.shutdown();
});
