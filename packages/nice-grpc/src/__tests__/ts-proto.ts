import getPort = require('get-port');
import {createChannel, createClient, createServer} from '..';
import {
  DeepPartial,
  TestDefinition,
  Test2Definition,
  TestRequest,
  TestResponse,
} from '../../fixtures/ts-proto/test';
import {throwUnimplemented} from './utils/throwUnimplemented';

test('basic', async () => {
  const server = createServer();

  server.add(TestDefinition, {
    async testUnary(request: TestRequest): Promise<DeepPartial<TestResponse>> {
      return {
        id: request.id,
      };
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestDefinition, channel);

  await expect(client.testUnary({id: 'test'})).resolves.toMatchInlineSnapshot(`
          Object {
            "id": "test",
          }
        `);

  channel.close();

  await server.shutdown();
});

test('middleware', async () => {
  const server = createServer();

  const middlewareCalls: any[] = [];

  server
    .with(async function* (call, context) {
      middlewareCalls.push(call);

      return yield* call.next(call.request, context);
    })
    .add(Test2Definition, {
      async testUnary(
        request: TestRequest,
      ): Promise<DeepPartial<TestResponse>> {
        return {
          id: request.id,
        };
      },
    });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(Test2Definition, channel);

  await expect(client.testUnary({id: 'test'})).resolves.toMatchInlineSnapshot(`
          Object {
            "id": "test",
          }
        `);
  expect(middlewareCalls).toMatchInlineSnapshot(`
    Array [
      Object {
        "method": Object {
          "options": Object {
            "idempotencyLevel": "IDEMPOTENT",
          },
          "path": "/nice_grpc.test.Test2/TestUnary",
        },
        "next": [Function],
        "request": Object {
          "id": "test",
        },
        "requestStream": false,
        "responseStream": false,
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
