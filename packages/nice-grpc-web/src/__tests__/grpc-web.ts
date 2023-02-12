import {createChannel, createClient} from '..';
import {TestRequest, TestResponse} from '../../fixtures/grpc-web/test_pb';
import {Test} from '../../fixtures/grpc-web/test_pb_service';
import {startRemoteTestServer} from '../../test-server/client';

describe('grpc-web protoc plugin', () => {
  it('sends a request and returns a response', async () => {
    const server = await startRemoteTestServer({
      async testUnary(request) {
        return {
          id: request.id,
        };
      },
    });

    const channel = createChannel(server.address);
    const client = createClient(Test, channel);

    const request = new TestRequest();
    request.setId('test');

    const expectedResponse = new TestResponse();
    expectedResponse.setId('test');

    expect(await client.testUnary(request)).toEqual(expectedResponse);

    server.shutdown();
  });
});
