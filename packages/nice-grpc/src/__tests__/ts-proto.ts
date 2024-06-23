import {ClientMiddleware, ServerMiddleware} from 'nice-grpc-common';
import {createChannel, createClient, createServer} from '..';
import {
  DeepPartial,
  TestClient,
  TestDefinition,
  Test2Definition,
  TestRequest,
  TestResponse,
  TestServiceImplementation,
  Test2ServiceImplementation,
  Test2Client,
} from '../../fixtures/ts-proto/test';
import {createClientFactory} from '../client/ClientFactory';
import {throwUnimplemented} from './utils/throwUnimplemented';

test('basic', async () => {
  const server = createServer();

  const impl: TestServiceImplementation = {
    async testUnary(request: TestRequest): Promise<DeepPartial<TestResponse>> {
      return {
        id: request.id,
      };
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  };

  server.add(TestDefinition, impl);

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client: TestClient = createClient(TestDefinition, channel);

  await expect(client.testUnary({id: 'test'})).resolves.toMatchInlineSnapshot(`
    {
      "id": "test",
    }
  `);

  channel.close();

  await server.shutdown();
});

test('middleware', async () => {
  const server = createServer();

  const serverMiddlewareCalls: any[] = [];

  const serverMiddleware: ServerMiddleware<{foo: 'bar'}> = async function* (
    call,
    context,
  ) {
    serverMiddlewareCalls.push(call);

    return yield* call.next(call.request, {
      ...context,
      foo: 'bar',
    });
  };

  const impl: Test2ServiceImplementation<{foo: 'bar'}> = {
    async testUnary(request: TestRequest): Promise<DeepPartial<TestResponse>> {
      return {
        id: request.id,
      };
    },
  };

  server.with(serverMiddleware).add(Test2Definition, impl);

  const port = await server.listen('127.0.0.1:0');

  const clientMiddlewareCalls: any[] = [];

  const clientMiddleware: ClientMiddleware<{bar: 'baz'}> = async function* (
    call,
    options,
  ) {
    const {bar, ...rest} = options;
    clientMiddlewareCalls.push({call, bar});

    return yield* call.next(call.request, rest);
  };

  const channel = createChannel(`127.0.0.1:${port}`);
  const client: Test2Client<{bar: 'baz'}> = createClientFactory()
    .use(clientMiddleware)
    .create(Test2Definition, channel);

  await expect(client.testUnary({id: 'test'}, {bar: 'baz'})).resolves
    .toMatchInlineSnapshot(`
    {
      "id": "test",
    }
  `);
  expect(serverMiddlewareCalls).toMatchInlineSnapshot(`
    [
      {
        "method": {
          "options": {
            "idempotencyLevel": "IDEMPOTENT",
          },
          "path": "/nice_grpc.test.Test2/TestUnary",
          "requestStream": false,
          "responseStream": false,
        },
        "next": [Function],
        "request": {
          "id": "test",
        },
        "requestStream": false,
        "responseStream": false,
      },
    ]
  `);

  expect(clientMiddlewareCalls).toMatchInlineSnapshot(`
    [
      {
        "bar": "baz",
        "call": {
          "method": {
            "options": {
              "idempotencyLevel": "IDEMPOTENT",
            },
            "path": "/nice_grpc.test.Test2/TestUnary",
            "requestStream": false,
            "responseStream": false,
          },
          "next": [Function],
          "request": {
            "id": "test",
          },
          "requestStream": false,
          "responseStream": false,
        },
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
