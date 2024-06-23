import {
  createChannel,
  createClientFactory,
  createServer,
  Metadata,
  ServerError,
  Status,
} from '../..';
import {TestService} from '../../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../../fixtures/grpc-js/test_pb';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';
import {throwUnimplemented} from '../utils/throwUnimplemented';

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

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(TestService, channel);

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
    [
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
    [
      {
        "options": {
          "testOption": "test-value",
        },
        "requestStream": true,
        "responseStream": true,
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
          "id": "test-1",
        },
        "type": "response",
      },
      {
        "response": nice_grpc.test.TestResponse {
          "id": "test-2",
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
    testClientStream: throwUnimplemented,
    async *testBidiStream(request: AsyncIterable<TestRequest>) {
      for await (const item of request) {
        throw new ServerError(Status.NOT_FOUND, item.getId());
      }
    },
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(TestService, channel);

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
    [
      {
        "error": [ClientError: /nice_grpc.test.Test/TestBidiStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  expect(actions).toMatchInlineSnapshot(`
    [
      {
        "options": {
          "testOption": "test-value",
        },
        "requestStream": true,
        "responseStream": true,
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
        "error": [ClientError: /nice_grpc.test.Test/TestBidiStream NOT_FOUND: test-1],
        "type": "error",
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
