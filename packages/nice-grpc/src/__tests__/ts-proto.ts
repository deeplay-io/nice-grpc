import getPort = require('get-port');
import {createChannel, createClient, createServer} from '..';
import {
  DeepPartial,
  TestDefinition,
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
