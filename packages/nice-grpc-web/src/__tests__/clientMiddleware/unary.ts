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

describe('clientMiddleware / unary', () => {
  it('passes a successful call through middleware', async () => {
    const actions: any[] = [];
    let metadataValue: string | undefined;

    const server = await startRemoteTestServer({
      async testUnary(request, context) {
        metadataValue = context.metadata.get('test');
        return {id: request.id};
      },
    });

    const channel = createChannel(server.address, WebsocketTransport());

    const client = createClientFactory()
      .use(createTestClientMiddleware('testOption', actions))
      .create(TestDefinition, channel);

    const metadata = Metadata();
    metadata.set('test', 'test-metadata-value');

    expect(
      await client.testUnary(
        {id: 'test'},
        {
          testOption: 'test-value',
          metadata,
        },
      ),
    ).toEqual({
      id: 'test',
    });

    expect(metadataValue).toEqual('test-metadata-value');

    expect(actions).toEqual([
      {
        options: {
          testOption: 'test-value',
        },
        requestStream: false,
        responseStream: false,
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
          id: 'test',
        },
        type: 'response',
      },
    ]);

    server.shutdown();
  });

  it('passes an erroneous call through middleware', async () => {
    const actions: any[] = [];

    const server = await startRemoteTestServer({
      async testUnary(request) {
        throw new ServerError(Status.NOT_FOUND, request.id);
      },
    });

    const channel = createChannel(server.address, WebsocketTransport());

    const client = createClientFactory()
      .use(createTestClientMiddleware('testOption', actions))
      .create(TestDefinition, channel);

    expect(
      await client
        .testUnary(
          {id: 'test'},
          {
            testOption: 'test-value',
          },
        )
        .then(
          () => {},
          err => err,
        ),
    ).toEqual(
      new ClientError(
        '/nice_grpc.test.Test/TestUnary',
        Status.NOT_FOUND,
        'test',
      ),
    );

    expect(actions).toEqual([
      {
        options: {
          testOption: 'test-value',
        },
        requestStream: false,
        responseStream: false,
        type: 'start',
      },
      {
        request: {
          id: 'test',
        },
        type: 'request',
      },
      {
        error: new ClientError(
          '/nice_grpc.test.Test/TestUnary',
          Status.NOT_FOUND,
          'test',
        ),
        type: 'error',
      },
    ]);

    server.shutdown();
  });
});
