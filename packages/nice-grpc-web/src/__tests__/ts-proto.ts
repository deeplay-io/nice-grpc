import getPort = require('get-port');
import {createServer} from 'nice-grpc';
import {createChannel, createClient} from '..';
import {
  DeepPartial,
  TestClient,
  TestDefinition,
  TestRequest,
  TestResponse,
} from '../../fixtures/ts-proto/test';
import {startGrpcWebProxy} from './utils/grpcwebproxy';
import {throwUnimplemented} from './utils/throwUnimplemented';
import {WebsocketTransport} from './utils/WebsocketTransport';

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

  const listenPort = await server.listen('0.0.0.0:0');

  const proxyPort = await getPort();
  const proxy = await startGrpcWebProxy(proxyPort, listenPort);

  const channel = createChannel(
    `http://localhost:${proxyPort}`,
    WebsocketTransport(),
  );
  const client: TestClient = createClient(TestDefinition, channel);

  await expect(client.testUnary({id: 'test'})).resolves.toMatchInlineSnapshot(`
          Object {
            "id": "test",
          }
        `);

  proxy.stop();
  await server.shutdown();
});
