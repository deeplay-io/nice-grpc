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
    async *testServerStream(request: TestRequest, context) {
      metadataValue = context.metadata.get('test');
      yield new TestResponse().setId(`${request.getId()}-0`);
      yield new TestResponse().setId(`${request.getId()}-1`);
    },
    testClientStream: throwUnimplemented,
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

  const responses: any[] = [];

  for await (const response of client.testServerStream(
    new TestRequest().setId('test'),
    {
      testOption: 'test-value',
      metadata,
    },
  )) {
    responses.push(response);
  }

  expect(responses).toMatchInlineSnapshot(`
    Array [
      nice_grpc.test.TestResponse {
        "id": "test-0",
      },
      nice_grpc.test.TestResponse {
        "id": "test-1",
      },
    ]
  `);

  expect(metadataValue).toMatchInlineSnapshot(`"test-metadata-value"`);

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "options": Object {
          "testOption": "test-value",
        },
        "requestStream": false,
        "responseStream": true,
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
          "id": "test-0",
        },
        "type": "response",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test-1",
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
    async *testServerStream(request: TestRequest) {
      yield new TestResponse().setId(`${request.getId()}-0`);
      throw new ServerError(Status.NOT_FOUND, `${request.getId()}-1`);
    },
    testClientStream: throwUnimplemented,
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

  const responses: any[] = [];

  try {
    for await (const response of client.testServerStream(
      new TestRequest().setId('test'),
      {
        testOption: 'test-value',
      },
    )) {
      responses.push({type: 'response', response});
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    Array [
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test-0",
        },
        "type": "response",
      },
      Object {
        "error": [ClientError: /nice_grpc.test.Test/TestServerStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "options": Object {
          "testOption": "test-value",
        },
        "requestStream": false,
        "responseStream": true,
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
          "id": "test-0",
        },
        "type": "response",
      },
      Object {
        "error": [ClientError: /nice_grpc.test.Test/TestServerStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  proxy.stop();
  await server.shutdown();
});
