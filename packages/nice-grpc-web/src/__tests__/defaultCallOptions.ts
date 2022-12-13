import getPort = require('get-port');
import {createServer, Server} from 'nice-grpc';
import {Channel, createChannel, createClient, Metadata} from '..';
import {TestService} from '../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/grpc-js/test_pb';
import {Test} from '../../fixtures/grpc-web/test_pb_service';
import {startGrpcWebProxy} from './utils/grpcwebproxy';
import {throwUnimplemented} from './utils/throwUnimplemented';
import {WebsocketTransport} from './utils/WebsocketTransport';

let server: Server;
let proxy: {stop(): void};
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

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  proxy = await startGrpcWebProxy(proxyPort, listenPort);

  channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );
});

afterEach(async () => {
  proxy.stop();
  await server.shutdown();
});

test('all methods', async () => {
  const metadata = Metadata();
  metadata.set('test', 'test-value');

  const client = createClient(Test, channel, {
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

  const client = createClient(Test, channel, {
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
