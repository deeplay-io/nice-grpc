import {status} from '@grpc/grpc-js';
import {ITestService, TestService} from '../../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/test_pb';
import {createChannel} from '../client/channel';
import {createClient} from '../client/ClientFactory';
import {createServer} from '../server/Server';
import {ServerError} from '../server/ServerError';
import {ServiceImplementation} from '../server/ServiceImplementation';
import getPort = require('get-port');

test('server class', async () => {
  const server = createServer();

  class TestServer implements ServiceImplementation<ITestService> {
    async testUnary(request: TestRequest): Promise<TestResponse> {
      return new TestResponse().setId(request.getId());
    }
    async *testServerStream(request: TestRequest): AsyncIterable<TestResponse> {
      throw new ServerError(status.UNIMPLEMENTED, '');
    }
    async testClientStream(
      request: AsyncIterable<TestRequest>,
    ): Promise<TestResponse> {
      throw new ServerError(status.UNIMPLEMENTED, '');
    }
    async *testBidiStream(
      request: AsyncIterable<TestRequest>,
    ): AsyncIterable<TestResponse> {
      throw new ServerError(status.UNIMPLEMENTED, '');
    }
  }

  server.add(TestService, new TestServer());

  const address = `localhost:${await getPort()}`;

  await server.listen(address);

  const channel = createChannel(address);
  const client = createClient(TestService, channel);

  await expect(client.testUnary(new TestRequest().setId('test'))).resolves
    .toMatchInlineSnapshot(`
          nice_grpc.test.TestResponse {
            "id": "test",
          }
        `);

  channel.close();

  await server.shutdown();
});
