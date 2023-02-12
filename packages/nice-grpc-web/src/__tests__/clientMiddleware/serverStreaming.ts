import {ServerError} from 'nice-grpc-common';
import {
  ClientError,
  createChannel,
  createClientFactory,
  Metadata,
  Status,
  WebsocketTransport,
} from '../..';
import {TestDefinition} from '../../../fixtures/ts-proto/test';
import {startRemoteTestServer} from '../../../test-server/client';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';

describe('clientMiddleware / serverStreaming', () => {
  it('passes a successful call through middleware', async () => {
    const actions: any[] = [];
    let metadataValue: string | undefined;

    const server = await startRemoteTestServer({
      async *testServerStream(request, context) {
        metadataValue = context.metadata.get('test');
        yield {id: `${request.id}-0`};
        yield {id: `${request.id}-1`};
      },
    });

    const channel = createChannel(server.address, WebsocketTransport());

    const client = createClientFactory()
      .use(createTestClientMiddleware('testOption', actions))
      .create(TestDefinition, channel);

    const metadata = Metadata();
    metadata.set('test', 'test-metadata-value');

    const responses: any[] = [];

    for await (const response of client.testServerStream(
      {id: 'test'},
      {
        testOption: 'test-value',
        metadata,
      },
    )) {
      responses.push(response);
    }

    expect(responses).toEqual([{id: 'test-0'}, {id: 'test-1'}]);

    expect(metadataValue).toEqual('test-metadata-value');

    expect(actions).toEqual([
      {
        options: {
          testOption: 'test-value',
        },
        requestStream: false,
        responseStream: true,
        type: 'start',
      },
      {
        request: {
          id: 'test',
        },
        type: 'request',
      },
      {
        response: {
          id: 'test-0',
        },
        type: 'response',
      },
      {
        response: {
          id: 'test-1',
        },
        type: 'response',
      },
    ]);

    server.shutdown();
  });

  it('passes an erroneous call through middleware', async () => {
    const actions: any[] = [];

    const server = await startRemoteTestServer({
      async *testServerStream(request) {
        yield {id: `${request.id}-0`};
        throw new ServerError(Status.NOT_FOUND, `${request.id}-1`);
      },
    });

    const channel = createChannel(server.address, WebsocketTransport());

    const client = createClientFactory()
      .use(createTestClientMiddleware('testOption', actions))
      .create(TestDefinition, channel);

    const responses: any[] = [];

    try {
      for await (const response of client.testServerStream(
        {id: 'test'},
        {
          testOption: 'test-value',
        },
      )) {
        responses.push({type: 'response', response});
      }
    } catch (error) {
      responses.push({type: 'error', error});
    }

    expect(responses).toEqual([
      {
        response: {
          id: 'test-0',
        },
        type: 'response',
      },
      {
        error: new ClientError(
          '/nice_grpc.test.Test/TestServerStream',
          Status.NOT_FOUND,
          'test-1',
        ),
        type: 'error',
      },
    ]);

    expect(actions).toEqual([
      {
        options: {
          testOption: 'test-value',
        },
        requestStream: false,
        responseStream: true,
        type: 'start',
      },
      {
        request: {
          id: 'test',
        },
        type: 'request',
      },
      {
        response: {
          id: 'test-0',
        },
        type: 'response',
      },
      {
        error: new ClientError(
          '/nice_grpc.test.Test/TestServerStream',
          Status.NOT_FOUND,
          'test-1',
        ),
        type: 'error',
      },
    ]);

    server.shutdown();
  });
});
