import {ServerError} from 'nice-grpc-common';
import {
  ClientError,
  createChannel,
  createClientFactory,
  Metadata,
  Status,
  WebsocketTransport,
} from '../..';
import {TestDefinition, TestRequest} from '../../../fixtures/ts-proto/test';
import {startRemoteTestServer} from '../../../test-server/client';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';

describe('clientMiddleware / clientStreaming', () => {
  it('passes a successful call through middleware', async () => {
    const actions: any[] = [];
    let metadataValue: string | undefined;

    const server = await startRemoteTestServer({
      async testClientStream(request, context) {
        metadataValue = context.metadata.get('test');

        const requests: TestRequest[] = [];

        for await (const req of request) {
          requests.push(req);
        }

        return {
          id: requests.map(request => request.id).join(' '),
        };
      },
    });

    const channel = createChannel(server.address, WebsocketTransport());

    const client = createClientFactory()
      .use(createTestClientMiddleware('testOption', actions))
      .create(TestDefinition, channel);

    const metadata = Metadata();
    metadata.set('test', 'test-metadata-value');

    async function* createRequest() {
      yield {id: 'test-1'};
      yield {id: 'test-2'};
    }

    expect(
      await client.testClientStream(createRequest(), {
        testOption: 'test-value',
        metadata,
      }),
    ).toEqual({
      id: 'test-1 test-2',
    });

    expect(metadataValue).toEqual('test-metadata-value');

    expect(actions).toEqual([
      {
        options: {
          testOption: 'test-value',
        },
        requestStream: true,
        responseStream: false,
        type: 'start',
      },
      {
        request: {
          id: 'test-1',
        },
        type: 'request',
      },
      {
        request: {
          id: 'test-2',
        },
        type: 'request',
      },
      {
        response: {
          id: 'test-1 test-2',
        },
        type: 'response',
      },
    ]);

    server.shutdown();
  });

  it('passes an erroneous call through middleware', async () => {
    const actions: any[] = [];

    const server = await startRemoteTestServer({
      async testClientStream(request) {
        for await (const item of request) {
          throw new ServerError(Status.NOT_FOUND, item.id);
        }

        return {};
      },
    });

    const channel = createChannel(server.address, WebsocketTransport());

    const client = createClientFactory()
      .use(createTestClientMiddleware('testOption', actions))
      .create(TestDefinition, channel);

    async function* createRequest() {
      yield {id: 'test-1'};
      yield {id: 'test-2'};
    }

    expect(
      await client
        .testClientStream(createRequest(), {
          testOption: 'test-value',
        })
        .then(
          () => {},
          err => err,
        ),
    ).toEqual(
      new ClientError(
        '/nice_grpc.test.Test/TestClientStream',
        Status.NOT_FOUND,
        'test-1',
      ),
    );

    expect(actions).toEqual([
      {
        options: {
          testOption: 'test-value',
        },
        requestStream: true,
        responseStream: false,
        type: 'start',
      },
      {
        request: {
          id: 'test-1',
        },
        type: 'request',
      },
      {
        request: {
          id: 'test-2',
        },
        type: 'request',
      },
      {
        error: new ClientError(
          '/nice_grpc.test.Test/TestClientStream',
          Status.NOT_FOUND,
          'test-1',
        ),
        type: 'error',
      },
    ]);

    server.shutdown();
  });
});
