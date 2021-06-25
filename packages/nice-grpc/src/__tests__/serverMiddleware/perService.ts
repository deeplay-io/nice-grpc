import getPort = require('get-port');
import {createChannel, createClient, createServer} from '../..';
import {Test2Service, TestService} from '../../../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../../../fixtures/test_pb';
import {createTestServerMiddleware} from '../utils/testServerMiddleware';
import {throwUnimplemented} from '../utils/throwUnimplemented';

test('per service', async () => {
  const actions: any[] = [];

  const server = createServer().use(
    createTestServerMiddleware(
      {test1: 'test-value-1'},
      actions,
      'middleware1-',
    ),
  );

  server
    .with(
      createTestServerMiddleware(
        {test2: 'test-value-2'},
        actions,
        'middleware2-',
      ),
    )
    .add(TestService, {
      async testUnary(request: TestRequest, context) {
        actions.push({
          type: 'test-request',
          test1: context.test1,
          test2: context.test2,
        });
        return new TestResponse().setId(request.getId());
      },
      testServerStream: throwUnimplemented,
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

  server.add(Test2Service, {
    async testUnary(request: TestRequest, context) {
      actions.push({
        type: 'test2-request',
        test1: context.test1,
        test2: (context as any).test2,
      });
      return new TestResponse().setId(request.getId());
    },
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const testClient = createClient(TestService, channel);
  const test2Client = createClient(Test2Service, channel);

  await expect(testClient.testUnary(new TestRequest().setId('test'))).resolves
    .toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test",
          }
        `);

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "requestStream": false,
        "responseStream": false,
        "type": "middleware1-start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "middleware1-request",
      },
      Object {
        "requestStream": false,
        "responseStream": false,
        "type": "middleware2-start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "middleware2-request",
      },
      Object {
        "test1": "test-value-1",
        "test2": "test-value-2",
        "type": "test-request",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "middleware2-response",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "middleware1-response",
      },
    ]
  `);

  actions.length = 0;

  await expect(test2Client.testUnary(new TestRequest().setId('test'))).resolves
    .toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test",
          }
        `);

  expect(actions).toMatchInlineSnapshot(`
    Array [
      Object {
        "requestStream": false,
        "responseStream": false,
        "type": "middleware1-start",
      },
      Object {
        "request": nice_grpc.test.TestRequest {
          "id": "test",
        },
        "type": "middleware1-request",
      },
      Object {
        "test1": "test-value-1",
        "test2": undefined,
        "type": "test2-request",
      },
      Object {
        "response": nice_grpc.test.TestResponse {
          "id": "test",
        },
        "type": "middleware1-response",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
