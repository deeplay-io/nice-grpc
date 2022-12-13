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
    testUnary: throwUnimplemented,
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>, context) {
      metadataValue = context.metadata.get('test');

      for await (const req of request) {
        yield new TestResponse().setId(req.getId());
      }
    },
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

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    yield new TestRequest().setId('test-2');
  }

  const responses: any[] = [];

  for await (const response of client.testBidiStream(createRequest(), {
    testOption: 'test-value',
    metadata,
  })) {
    responses.push(response);
  }

  expect(responses).toMatchInlineSnapshot(`
    Array [
      nice_grpc.test.TestResponse {
        "id": "test-1",
      },
      nice_grpc.test.TestResponse {
        "id": "test-2",
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
        "requestStream": true,
        "responseStream": true,
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
          "id": "test-1",
        },
        "type": "response",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test-2",
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
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>) {
      for await (const item of request) {
        throw new ServerError(Status.NOT_FOUND, item.getId());
      }
    },
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

  async function* createRequest() {
    yield new TestRequest().setId('test-1');
    yield new TestRequest().setId('test-2');
  }

  const responses: any[] = [];

  try {
    for await (const response of client.testBidiStream(createRequest(), {
      testOption: 'test-value',
    })) {
      responses.push({type: 'response', response});
    }
  } catch (error) {
    responses.push({type: 'error', error});
  }

  expect(responses).toMatchInlineSnapshot(`
    Array [
      Object {
        "error": [ClientError: /nice_grpc.test.Test/TestBidiStream NOT_FOUND: test-1],
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
        "requestStream": true,
        "responseStream": true,
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
        "error": [ClientError: /nice_grpc.test.Test/TestBidiStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  proxy.stop();
  await server.shutdown();
});
