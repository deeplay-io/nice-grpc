import {
  createChannel,
  createClient,
  createServer,
  ServerError,
  ServiceImplementation,
  Status,
} from '..';
import {ITestService, TestService} from '../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/grpc-js/test_pb';

test('server class', async () => {
  const server = createServer();

  class TestServer implements ServiceImplementation<ITestService> {
    async testUnary(request: TestRequest): Promise<TestResponse> {
      return new TestResponse().setId(request.getId());
    }
    async *testServerStream(request: TestRequest): AsyncIterable<TestResponse> {
      throw new ServerError(Status.UNIMPLEMENTED, '');
    }
    async testClientStream(
      request: AsyncIterable<TestRequest>,
    ): Promise<TestResponse> {
      throw new ServerError(Status.UNIMPLEMENTED, '');
    }
    async *testBidiStream(
      request: AsyncIterable<TestRequest>,
    ): AsyncIterable<TestResponse> {
      throw new ServerError(Status.UNIMPLEMENTED, '');
    }
  }

  server.add(TestService, new TestServer());

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
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
