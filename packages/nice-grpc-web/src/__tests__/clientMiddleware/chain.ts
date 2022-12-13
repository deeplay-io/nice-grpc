import getPort = require('get-port');
import {createServer} from 'nice-grpc';
import {createChannel, createClientFactory} from '../..';
import {TestService} from '../../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../../fixtures/grpc-js/test_pb';
import {Test} from '../../../fixtures/grpc-web/test_pb_service';
import {startGrpcWebProxy} from '../utils/grpcwebproxy';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';
import {throwUnimplemented} from '../utils/throwUnimplemented';
import {WebsocketTransport} from '../utils/WebsocketTransport';

test('chain', async () => {
  const actions: any[] = [];

  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest) {
      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
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
    .use(createTestClientMiddleware('testOption1', actions, 'middleware-1-'))
    .use(createTestClientMiddleware('testOption2', actions, 'middleware-2-'))
    .create(Test, channel);

  await expect(
    client.testUnary(new TestRequest().setId('test'), {
      testOption1: 'test-value-1',
      testOption2: 'test-value-2',
    }),
  ).resolves.toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test",
          }
        `);

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "options": Object {
          "testOption2": "test-value-2",
        },
        "requestStream": false,
        "responseStream": false,
        "type": "middleware-2-start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "middleware-2-request",
      },
      Object {
        "options": Object {
          "testOption1": "test-value-1",
        },
        "requestStream": false,
        "responseStream": false,
        "type": "middleware-1-start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "middleware-1-request",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "middleware-1-response",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "middleware-2-response",
      },
    ]
  `);

  proxy.stop();
  await server.shutdown();
});

test('set option from middleware', async () => {
  const actions: any[] = [];

  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest) {
      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
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
    .use<{testOption1: string}>(async function* middleware1(call, options) {
      const {testOption1, ...restOptions} = options;

      actions.push({type: 'middleware-1-start', options: {testOption1}});

      return yield* call.next(call.request, restOptions);
    })
    .use<{testOption2: string}>(async function* middleware1(call, options) {
      const {testOption1, testOption2, ...restOptions} = options;

      actions.push({
        type: 'middleware-2-start',
        options: {testOption1, testOption2},
      });

      return yield* call.next(call.request, {
        ...restOptions,
        testOption1: 'test-value-1-from-middleware-2',
      });
    })
    .create(Test, channel);

  await expect(
    client.testUnary(new TestRequest().setId('test'), {
      testOption1: 'test-value-1',
      testOption2: 'test-value-2',
    }),
  ).resolves.toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test",
          }
        `);

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "options": Object {
          "testOption1": "test-value-1",
          "testOption2": "test-value-2",
        },
        "type": "middleware-2-start",
      },
      Object {
        "options": Object {
          "testOption1": "test-value-1-from-middleware-2",
        },
        "type": "middleware-1-start",
      },
    ]
  `);

  proxy.stop();
  await server.shutdown();
});
