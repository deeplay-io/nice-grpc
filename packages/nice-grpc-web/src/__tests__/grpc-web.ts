import {createChannel, createClient} from '..';
import {TestRequest, TestResponse} from '../../fixtures/grpc-web/test_pb';
import {Test} from '../../fixtures/grpc-web/test_pb_service';
import {startRemoteTestServer} from './utils/mockServer/control';

describe('grpc-web protoc plugin', () => {
  it('sends a request and returns a response', async () => {
    const server = await startRemoteTestServer('ws://localhost:18283', {
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
