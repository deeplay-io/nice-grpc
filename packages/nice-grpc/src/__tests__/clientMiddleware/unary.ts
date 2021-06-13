import {Metadata, MetadataValue, status} from '@grpc/grpc-js';
import getPort = require('get-port');
import {TestService} from '../../../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../../../fixtures/test_pb';
import {createChannel} from '../../client/channel';
import {createClientFactory} from '../../client/ClientFactory';
import {createServer} from '../../server/Server';
import {ServerError} from '../../server/ServerError';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';
import {throwUnimplemented} from '../utils/throwUnimplemented';

test('basic', async () => {
  const actions: any[] = [];
  let metadataValue: MetadataValue | undefined;

  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      metadataValue = context.metadata.get('test')[0];
      return new TestResponse().setId(request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(TestService, channel);

  const metadata = new Metadata();
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

  channel.close();

  await server.shutdown();
});

test('error', async () => {
  const actions: any[] = [];

  const server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest) {
      throw new ServerError(status.NOT_FOUND, request.getId());
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClientFactory()
    .use(createTestClientMiddleware('testOption', actions))
    .create(TestService, channel);

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

  channel.close();

  await server.shutdown();
});
