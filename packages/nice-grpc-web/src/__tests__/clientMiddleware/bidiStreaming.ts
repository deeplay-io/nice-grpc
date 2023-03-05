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

describe('clientMiddleware / bidiStreaming', () => {
  it('passes a successful call through middleware', async () => {
    const actions: any[] = [];
    let metadataValue: string | undefined;

    const server = await startRemoteTestServer({
      async *testBidiStream(request, context) {
        metadataValue = context.metadata.get('test');

        for await (const req of request) {
          yield {id: req.id};
        }
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

    const responses: any[] = [];

    for await (const response of client.testBidiStream(createRequest(), {
      testOption: 'test-value',
      metadata,
    })) {
      responses.push(response);
    }

    expect(responses).toEqual([{id: 'test-1'}, {id: 'test-2'}]);

    expect(metadataValue).toEqual('test-metadata-value');

    expect(actions).toEqual([
      {
        options: {
          testOption: 'test-value',
        },
        requestStream: true,
        responseStream: true,
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
          id: 'test-1',
        },
        type: 'response',
      },
      {
        response: {
          id: 'test-2',
        },
        type: 'response',
      },
    ]);

    server.shutdown();
  });

  it('passes an erroneous call through middleware', async () => {
    const actions: any[] = [];

    const server = await startRemoteTestServer({
      async *testBidiStream(request) {
        for await (const item of request) {
          throw new ServerError(Status.NOT_FOUND, item.id);
        }
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

    const responses: any[] = [];

    try {
      for await (const response of client.testBidiStream(createRequest(), {
        testOption: 'test-value',
      })) {
        responses.push({type: 'response', response});
      }
    } catch (error) {
      responses.push({type: 'error', error});
    }

    expect(responses).toEqual([
      {
        error: new ClientError(
          '/nice_grpc.test.Test/TestBidiStream',
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
        requestStream: true,
        responseStream: true,
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
          '/nice_grpc.test.Test/TestBidiStream',
          Status.NOT_FOUND,
          'test-1',
        ),
        type: 'error',
      },
    ]);

    server.shutdown();
  });
});
