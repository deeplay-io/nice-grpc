import getPort = require('get-port');
import {createServer, ServerError} from 'nice-grpc';
import {createChannel, createClientFactory, Metadata, Status} from '../..';
import {TestService} from '../../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../../fixtures/grpc-js/test_pb';
import {Test} from '../../../fixtures/grpc-web/test_pb_service';
import {startGrptWebProxy} from '../utils/grpcwebproxy';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';
import {throwUnimplemented} from '../utils/throwUnimplemented';
import {WebsocketTransport} from '../utils/WebsocketTransport';

test('basic', async () => {
  const actions: any[] = [];
  let metadataValue: string | undefined;

  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      metadataValue = context.metadata.get('test');
      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrptWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );

  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(Test, channel);

  const metadata = Metadata();
  metadata.set('test', 'test-metadata-value');

  await expect(
    client.testUnary(new TestRequest().setId('test'), {
      testOption: 'test-value',
      metadata,
    }),
  ).resolves.toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test",
          }
        `);

  expect(metadataValue).toMatchInlineSnapshot(`"test-metadata-value"`);

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "options": Object {
          "testOption": "test-value",
        },
        "requestStream": false,
        "responseStream": false,
        "type": "start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "request",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
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
    async testUnary(request: TestRequest) {
      throw new ServerError(Status.NOT_FOUND, request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrptWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );

  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(Test, channel);

  await expect(
    client.testUnary(new TestRequest().setId('test'), {
      testOption: 'test-value',
    }),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary NOT_FOUND: test]`,
  );

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "options": Object {
          "testOption": "test-value",
        },
        "requestStream": false,
        "responseStream": false,
        "type": "start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "request",
      },
      Object {
        "error": [ClientError: /nice_grpc.test.Test/TestUnary NOT_FOUND: test],
        "type": "error",
      },
    ]
  `);

  proxy.stop();
  await server.shutdown();
});
