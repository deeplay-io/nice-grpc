import getPort = require('get-port');
import {Channel} from '@grpc/grpc-js';
import {createChannel, createClient, createServer, Metadata, Server} from '..';
import {TestService} from '../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/grpc-js/test_pb';
import {throwUnimplemented} from './utils/throwUnimplemented';

let server: Server;
let channel: Channel;

beforeEach(async () => {
  server = createServer();

  server.add(TestService, {
    async testUnary(request: TestRequest, context) {
      const metadataValue = context.metadata.get('test') ?? '';
      return new TestResponse().setId(metadataValue);
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  channel = createChannel(address);
});

afterEach(async () => {
  channel.close();

  await server.shutdown();
});

test('all methods', async () => {
  const metadata = Metadata();
  metadata.set('test', 'test-value');

  const client = createClient(TestService, channel, {
    '*': {
      metadata,
    },
  });

  await expect(client.testUnary(new TestRequest())).resolves
    .toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test-value",
          }
        `);
});

test('particular method', async () => {
  const defaultMetadata = Metadata();
  defaultMetadata.set('test', 'test-default-value');

  const metadata = Metadata();
  metadata.set('test', 'test-value');

  const client = createClient(TestService, channel, {
    '*': {
      metadata: defaultMetadata,
    },
    testUnary: {
      metadata,
    },
  });

  await expect(client.testUnary(new TestRequest())).resolves
    .toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test-value",
          }
        `);
});
