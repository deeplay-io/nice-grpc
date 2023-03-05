import {createChannel, createClientFactory, WebsocketTransport} from '../..';
import {TestDefinition} from '../../../fixtures/ts-proto/test';
import {startRemoteTestServer} from '../../../test-server/client';
import {createTestClientMiddleware} from '../utils/testClientMiddleware';

describe('clientMiddleware / chain', () => {
  it('passes a call through middleware chain', async () => {
    const actions: any[] = [];

    const server = await startRemoteTestServer({
      async testUnary(request) {
        return {id: request.id};
      },
    });

    const channel = createChannel(server.address, WebsocketTransport());

    const client = createClientFactory()
      .use(createTestClientMiddleware('testOption1', actions, 'middleware-1-'))
      .use(createTestClientMiddleware('testOption2', actions, 'middleware-2-'))
      .create(TestDefinition, channel);

    expect(
      await client.testUnary(
        {id: 'test'},
        {
          testOption1: 'test-value-1',
          testOption2: 'test-value-2',
        },
      ),
    ).toEqual({
      id: 'test',
    });

    expect(actions).toEqual([
      {
        options: {
          testOption2: 'test-value-2',
        },
        requestStream: false,
        responseStream: false,
        type: 'middleware-2-start',
      },
      {
        request: {
          id: 'test',
        },
        type: 'middleware-2-request',
      },
      {
        options: {
          testOption1: 'test-value-1',
        },
        requestStream: false,
        responseStream: false,
        type: 'middleware-1-start',
      },
      {
        request: {
          id: 'test',
        },
        type: 'middleware-1-request',
      },
      {
        response: {
          id: 'test',
        },
        type: 'middleware-1-response',
      },
      {
        response: {
          id: 'test',
        },
        type: 'middleware-2-response',
      },
    ]);

    server.shutdown();
  });

  it('passes custom options call through middleware chain', async () => {
    const actions: any[] = [];

    const server = await startRemoteTestServer({
      async testUnary(request) {
        return {id: request.id};
      },
    });

    const channel = createChannel(server.address, WebsocketTransport());
    const client = createClientFactory()
      .use<{testOption1: string}>(async function* middleware1(call, options) {
        const {testOption1, ...restOptions} = options;

        actions.push({type: 'middleware-1-start', options: {testOption1}});

        return yield* call.next(call.request, restOptions);
      })
      .use<{testOption2: string}>(async function* middleware1(call, options) {
        const {testOption1, testOption2, ...restOptions} = options;

        actions.push({
          type: 'middleware-2-start',
          options: {testOption1, testOption2},
        });

        return yield* call.next(call.request, {
          ...restOptions,
          testOption1: 'test-value-1-from-middleware-2',
        });
      })
      .create(TestDefinition, channel);

    expect(
      await client.testUnary(
        {id: 'test'},
        {
          testOption1: 'test-value-1',
          testOption2: 'test-value-2',
        },
      ),
    ).toEqual({
      id: 'test',
    });

    expect(actions).toEqual([
      {
        options: {
          testOption1: 'test-value-1',
          testOption2: 'test-value-2',
        },
        type: 'middleware-2-start',
      },
      {
        options: {
          testOption1: 'test-value-1-from-middleware-2',
        },
        type: 'middleware-1-start',
      },
    ]);

    server.shutdown();
  });
});
