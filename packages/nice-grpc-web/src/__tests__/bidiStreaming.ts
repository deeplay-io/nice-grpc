import {forever, isAbortError} from 'abort-controller-x';
import {assertNever} from 'assert-never';
import {detect} from 'detect-browser';
import cartesianProduct from 'just-cartesian-product';
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
  if (
    process.env.FORCE_ALL_TESTS !== 'true' &&
    transport === 'fetch' &&
    (environment?.name === 'safari' ||
      environment?.name === 'ios' ||
      environment?.name === 'firefox' ||
      (environment?.name === 'chrome' && environment.os === 'Android OS') ||
      (environment?.name === 'chrome' && parseInt(environment.version) < 105) ||
      (environment?.name === 'chrome' && protocol === 'http') ||
      (environment?.name === 'edge-chromium' && protocol === 'http'))
  ) {
    // safari does not support constructing readable streams
    // most browsers do not support sending readable streams

    // chromium requires http2 (hence https) to send client streams

    return;
  }

  if (transport === 'node-http' && environment?.type !== 'node') {
    return;
  }

  describe(`bidiStreaming / ${proxyType} / ${transport} / ${protocol}`, () => {
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

    it('sends multiple requests and receives multiple responses', async function (this: Context) {
      const client = await this.init({
        async *testBidiStream(request, context) {
          context.header.set('test', 'test-header');
          context.trailer.set('test', 'test-trailer');

          for await (const req of request) {
            yield {id: req.id};
          }
        },
      });

      let header: Metadata | undefined;
      let trailer: Metadata | undefined;

      async function* createRequest() {
        yield {id: 'test-1'};
        yield {id: 'test-2'};
      }

      const responses: TestResponse[] = [];

      const iterable = client.testBidiStream(createRequest(), {
        onHeader(header_) {
          header = header_;
        },
        onTrailer(trailer_) {
          trailer = trailer_;
        },
      });

      for await (const response of iterable) {
        responses.push(response);
      }

      expect(responses).toEqual([{id: 'test-1'}, {id: 'test-2'}]);

      expect(header?.get('test')).toEqual('test-header');
      expect(trailer?.get('test')).toEqual('test-trailer');
    });

    it('receives an error', async function (this: Context) {
      const client = await this.init({
        async *testBidiStream(request, context) {
          context.header.set('test', 'test-header');
          context.trailer.set('test', 'test-trailer');

          for await (const item of request) {
            throw new ServerError(Status.NOT_FOUND, item.id);
          }
        },
      });

      let header: Metadata | undefined;
      let trailer: Metadata | undefined;
      let error: unknown;
      const responses: TestResponse[] = [];

      async function* createRequest() {
        yield {id: 'test-1'};
        yield {id: 'test-2'};
      }

      const iterable = client.testBidiStream(createRequest(), {
        onHeader(value) {
          header = value;
        },
        onTrailer(value) {
          trailer = value;
        },
      });

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
          '/nice_grpc.test.Test/TestBidiStream',
          Status.NOT_FOUND,
          'test-1',
        ),
      );

      expect(header?.get('test')).toEqual('test-header');
      expect(trailer?.get('test')).toEqual('test-trailer');
    });

    if (
      process.env.FORCE_ALL_TESTS !== 'true' &&
      (transport === 'fetch' ||
        (proxyType === 'grpcwebproxy' && transport !== 'websocket') ||
        proxyType === 'traefik')
    ) {
      // full duplex is not supported by fetch
      // grpcwebproxy and traefik do not send response before request is finished
    } else {
      it('receives a response before finishing sending request', async function (this: Context) {
        const serverResponseFinish = defer<void>();

        const client = await this.init({
          async *testBidiStream(request, context) {
            yield {id: 'test'};

            await serverResponseFinish.promise;
          },
        });

        const requestIterableFinish = defer<void>();

        async function* createRequest() {
          await requestIterableFinish.promise;
        }

        let count = 0;

        for await (const response of client.testBidiStream(createRequest())) {
          expect(count++).toEqual(0);
          expect(response).toEqual({id: 'test'});
          serverResponseFinish.resolve();
        }

        requestIterableFinish.resolve();
      });

      it('stops reading request iterable on response', async function (this: Context) {
        const client = await this.init({
          async *testBidiStream() {},
        });

        const responseFinish = defer<void>();

        let continuedReading = false;

        async function* createRequest() {
          await responseFinish.promise;

          yield {id: 'test'};

          continuedReading = true;
        }

        const responses: TestResponse[] = [];

        for await (const response of client.testBidiStream(createRequest())) {
          responses.push(response);
        }

        responseFinish.resolve();

        expect(responses).toEqual([]);
        expect(continuedReading).toEqual(false);
      });
    }

    it('cancels a call', async function (this: Context) {
      const serverRequestStartDeferred = defer<void>();
      const serverAbortDeferred = defer<void>();

      const client = await this.init({
        async *testBidiStream(request, {signal}) {
          serverRequestStartDeferred.resolve();

          try {
            await forever(signal);
          } catch (err) {
            if (isAbortError(err)) {
              serverAbortDeferred.resolve();
            }

            throw err;
          }
        },
      });

      const abortController = new AbortController();

      const requestIterableFinish = defer<void>();

      async function* createRequest() {
        // fetch may not send request until the first request is sent
        yield {id: 'test'};

        await requestIterableFinish.promise;
      }

      await Promise.all([
        Promise.resolve().then(async () => {
          const iterable = client.testBidiStream(createRequest(), {
            signal: abortController.signal,
          });

          const responses: TestResponse[] = [];
          let error: unknown;

          try {
            for await (const response of iterable) {
              responses.push(response);
            }
          } catch (err) {
            error = err;
          }

          expect(responses).toEqual([]);
          expect(isAbortError(error))
            .withContext(`Expected AbortError, got ${error}`)
            .toBe(true);
          requestIterableFinish.resolve();

          await serverAbortDeferred.promise;
        }),
        Promise.resolve().then(async () => {
          await serverRequestStartDeferred.promise;

          abortController.abort();
        }),
      ]);
    });

    it('handles request iterable error', async function (this: Context) {
      const serverRequestStartDeferred = defer<void>();

      const client = await this.init({
        async *testBidiStream(request) {
          for await (const _ of request) {
            serverRequestStartDeferred.resolve();
          }
        },
      });

      async function* createRequest() {
        yield {id: 'test-1'};

        await serverRequestStartDeferred.promise;

        throw new Error('test');
      }

      const responses: TestResponse[] = [];
      let error: unknown;

      const iterable = client.testBidiStream(createRequest());

      try {
        for await (const response of iterable) {
          responses.push(response);
        }
      } catch (err) {
        error = err;
      }

      expect(responses).toEqual([]);
      expect(error).toEqual(new Error('test'));
    });
  });
});
