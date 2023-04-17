import {forever, isAbortError} from 'abort-controller-x';
import {detect} from 'detect-browser';
import {ServerError} from 'nice-grpc-common';
import {
  ClientError,
  createChannel,
  createClient,
  FetchTransport,
  Metadata,
  Status,
  WebsocketTransport,
} from '..';

import {assertNever} from 'assert-never';
import cartesianProduct from 'just-cartesian-product';
import {
  TestClient,
  TestDefinition,
  TestResponse,
  TestServiceImplementation,
} from '../../fixtures/ts-proto/test';
import {
  RemoteTestServer,
  startRemoteTestServer,
} from '../../test-server/client';
import {NodeHttpTransport} from '../client/transports/nodeHttp';
import {defer} from './utils/defer';

const environment = detect();

[
  ...cartesianProduct([
    ['envoy' as const, 'grpcwebproxy' as const, 'traefik' as const],
    ['fetch' as const, 'node-http' as const],
    ['http' as const, 'https' as const],
  ]),
  ['grpcwebproxy', 'websocket', 'http'] as const,
].forEach(([proxyType, transport, protocol]) => {
  if (transport === 'node-http' && environment?.type !== 'node') {
    return;
  }

  describe(`serverStreaming / ${proxyType} / ${transport} / ${protocol}`, () => {
    type Context = {
      server?: RemoteTestServer;
      init(
        mockImplementation: Partial<TestServiceImplementation>,
      ): Promise<TestClient>;
    };

    beforeEach(function (this: Context) {
      this.init = async impl => {
        this.server = await startRemoteTestServer(impl, proxyType, protocol);

        return createClient(
          TestDefinition,
          createChannel(
            this.server.address,
            transport === 'fetch'
              ? FetchTransport()
              : transport === 'websocket'
              ? WebsocketTransport()
              : transport === 'node-http'
              ? NodeHttpTransport()
              : assertNever(transport),
          ),
        );
      };
    });

    afterEach(function (this: Context) {
      this.server?.shutdown();
    });

    it('sends request and receives multiple responses', async function (this: Context) {
      const client = await this.init({
        async *testServerStream(request, context) {
          context.header.set('test', `${request.id}-header`);
          context.trailer.set('test', `${request.id}-trailer`);
          yield {id: `${request.id}-1`};
          yield {id: `${request.id}-2`};
        },
      });

      let header: Metadata | undefined;
      let trailer: Metadata | undefined;
      const responses: TestResponse[] = [];

      const iterable = client.testServerStream(
        {id: 'test'},
        {
          onHeader(header_) {
            header = header_;
          },
          onTrailer(trailer_) {
            trailer = trailer_;
          },
        },
      );

      for await (const response of iterable) {
        responses.push(response);
      }

      expect(responses).toEqual([{id: 'test-1'}, {id: 'test-2'}]);
      expect(header?.get('test')).toEqual('test-header');
      expect(trailer?.get('test')).toEqual('test-trailer');
    });

    it('receives empty response', async function (this: Context) {
      const endDeferred = defer();

      const client = await this.init({
        async *testServerStream(request, context) {
          yield {};

          await endDeferred.promise;
        },
      });

      const iterable = client.testServerStream({});

      for await (const response of iterable) {
        expect(response).toEqual({id: ''});

        break;
      }

      endDeferred.resolve();
    });

    it('receives error', async function (this: Context) {
      const client = await this.init({
        async *testServerStream(request, context) {
          context.header.set('test', `${request.id}-header`);
          context.trailer.set('test', `${request.id}-trailer`);
          throw new ServerError(Status.ABORTED, request.id);
        },
      });

      let header: Metadata | undefined;
      let trailer: Metadata | undefined;
      const responses: TestResponse[] = [];
      let error: unknown;

      const iterable = client.testServerStream(
        {id: 'test'},
        {
          onHeader(header_) {
            header = header_;
          },
          onTrailer(trailer_) {
            trailer = trailer_;
          },
        },
      );

      try {
        for await (const response of iterable) {
          responses.push(response);
        }
      } catch (err) {
        error = err;
      }

      expect(responses).toEqual([]);
      expect(error).toEqual(
        new ClientError(
          '/nice_grpc.test.Test/TestServerStream',
          Status.ABORTED,
          'test',
        ),
      );
      expect(header?.get('test')).toEqual('test-header');
      expect(trailer?.get('test')).toEqual('test-trailer');
    });

    it('receives response and error', async function (this: Context) {
      const client = await this.init({
        async *testServerStream(request, context) {
          yield {id: `${request.id}-1`};

          context.trailer.set('test', `${request.id}-trailer`);

          throw new ServerError(Status.ABORTED, `${request.id}-2`);
        },
      });

      let trailer: Metadata | undefined;
      const responses: TestResponse[] = [];
      let error: unknown;

      const iterable = client.testServerStream(
        {id: 'test'},
        {
          onTrailer(trailer_) {
            trailer = trailer_;
          },
        },
      );

      try {
        for await (const response of iterable) {
          responses.push(response);
        }
      } catch (err) {
        error = err;
      }

      expect(responses).toEqual([{id: 'test-1'}]);
      expect(error).toEqual(
        new ClientError(
          '/nice_grpc.test.Test/TestServerStream',
          Status.ABORTED,
          'test-2',
        ),
      );
      expect(trailer?.get('test')).toEqual('test-trailer');
    });

    it('cancels a call', async function (this: Context) {
      const serverAbortDeferred = defer<void>();

      const client = await this.init({
        async *testServerStream(request, {signal}) {
          yield {id: request.id};

          try {
            return await forever(signal);
          } catch (err) {
            if (isAbortError(err)) {
              serverAbortDeferred.resolve();
            }

            throw err;
          }
        },
      });

      const abortController = new AbortController();

      const iterable = client.testServerStream(
        {id: 'test'},
        {
          signal: abortController.signal,
        },
      );

      const responses: TestResponse[] = [];
      let error: unknown;

      try {
        for await (const response of iterable) {
          responses.push(response);
          abortController.abort();
        }
      } catch (err) {
        error = err;
      }

      expect(responses).toEqual([{id: 'test'}]);
      expect(isAbortError(error))
        .withContext(`Expected AbortError, got ${error}`)
        .toBe(true);

      await serverAbortDeferred.promise;
    });

    it('receives header with first response', async function (this: Context) {
      const endDeferred = defer();

      const client = await this.init({
        async *testServerStream(request, context) {
          context.header.set('test', `${request.id}-1`);

          yield {id: `${request.id}-2`};

          await endDeferred.promise;
        },
      });

      let header: Metadata | undefined;

      const iterable = client.testServerStream(
        {id: 'test-value'},
        {
          onHeader(header_) {
            header = header_;
          },
        },
      );

      for await (const response of iterable) {
        expect(header?.get('test')).toEqual('test-value-1');
        expect(response).toEqual({id: 'test-value-2'});

        break;
      }

      endDeferred.resolve();
    });

    if (
      process.env.FORCE_ALL_TESTS !== 'true' &&
      (environment?.name === 'chrome' ||
        environment?.name === 'safari' ||
        environment?.name === 'ios' ||
        environment?.name === 'edge-chromium' ||
        environment?.name === 'firefox') &&
      transport === 'fetch'
    ) {
      // most browsers only receive headers after the first message is sent
    } else {
      it('receives early header', async function (this: Context) {
        const endDeferred = defer();

        const client = await this.init({
          async *testServerStream(request, context) {
            context.header.set('test', request.id);
            context.sendHeader();

            await endDeferred.promise;
          },
        });

        const headerDeferred = defer<Metadata>();

        const iterable = client.testServerStream(
          {id: 'test-value'},
          {
            onHeader(header) {
              headerDeferred.resolve(header);
            },
          },
        );

        await Promise.all([
          Promise.resolve().then(async () => {
            expect((await headerDeferred.promise).get('test')).toEqual(
              'test-value',
            );
            endDeferred.resolve();
          }),
          Promise.resolve().then(async () => {
            const responses: TestResponse[] = [];

            for await (const response of iterable) {
              responses.push(response);
            }

            expect(responses).toEqual([]);
          }),
        ]);
      });
    }

    it('receives high rate of responses', async function (this: Context) {
      const count = 1_000;

      const client = await this.init({
        async *testServerStream(request) {
          for (let i = 0; i < count; i++) {
            yield {id: `${i}`};
          }
        },
      });

      let i = 0;

      for await (const response of client.testServerStream({})) {
        expect(response.id).toBe(`${i++}`);
      }

      expect(i).toBe(count);
    });
  });
});
