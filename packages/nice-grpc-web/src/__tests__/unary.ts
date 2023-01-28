import {forever, isAbortError} from 'abort-controller-x';
import {detect} from 'detect-browser';
import {ClientError, ServerError} from 'nice-grpc-common';
import {createChannel, createClient, Metadata, Status} from '..';
import {
  TestClient,
  TestDefinition,
  TestResponse,
  TestServiceImplementation,
} from '../../fixtures/ts-proto/test';
import {FetchTransport} from '../client/transports/fetch';
import {WebsocketTransport} from '../client/transports/websocket';
import {defer} from './utils/defer';
import {
  RemoteTestServer,
  startRemoteTestServer,
} from './utils/mockServer/control';

const environment = detect();

(
  [
    ['grpcwebproxy', 'fetch'],
    ['grpcwebproxy', 'websocket'],
    ['envoy', 'fetch'],
  ] as const
).forEach(([proxyType, transport]) => {
  describe(`unary / ${proxyType} / ${transport}`, () => {
    type Context = {
      server?: RemoteTestServer;
      init(
        mockImplementation: Partial<TestServiceImplementation>,
      ): Promise<TestClient>;
    };

    beforeEach(function (this: Context) {
      this.init = async impl => {
        this.server = await startRemoteTestServer(
          `ws://localhost:18283/?proxy=${proxyType}`,
          impl,
        );

        return createClient(
          TestDefinition,
          createChannel(
            this.server.address,
            transport === 'fetch' ? FetchTransport() : WebsocketTransport(),
          ),
        );
      };
    });

    afterEach(function (this: Context) {
      this.server?.shutdown();
    });

    it('sends request and receives response', async function (this: Context) {
      const client = await this.init({
        async testUnary(request, context) {
          context.header.set('test', `${request.id}-header`);
          context.trailer.set('test', `${request.id}-trailer`);
          return {id: request.id};
        },
      });

      let header: Metadata | undefined;
      let trailer: Metadata | undefined;

      expect(
        await client.testUnary(
          {id: 'test'},
          {
            onHeader(header_) {
              header = header_;
            },
            onTrailer(trailer_) {
              trailer = trailer_;
            },
          },
        ),
      ).toEqual({id: 'test'});

      expect(header?.get('test')).toEqual('test-header');
      expect(trailer?.get('test')).toEqual('test-trailer');
    });

    it('receives an error', async function (this: Context) {
      const client = await this.init({
        async testUnary(request, context) {
          context.header.set('test', `${request.id}-header`);
          context.trailer.set('test', `${request.id}-trailer`);
          throw new ServerError(Status.NOT_FOUND, request.id);
        },
      });

      let header: Metadata | undefined;
      let trailer: Metadata | undefined;
      let error: unknown;

      try {
        await client.testUnary(
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
      } catch (err) {
        error = err;
      }

      expect(error).toEqual(
        new ClientError(
          '/nice_grpc.test.Test/TestUnary',
          Status.NOT_FOUND,
          'test',
        ),
      );
      expect(header?.get('test')).toEqual('test-header');
      expect(trailer?.get('test')).toEqual('test-trailer');
    });

    it('cancels a call', async function (this: Context) {
      const serverRequestStartDeferred = defer<void>();
      const serverAbortDeferred = defer<void>();

      const client = await this.init({
        async testUnary(request, {signal}) {
          serverRequestStartDeferred.resolve();

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

      await Promise.all([
        Promise.resolve().then(async () => {
          let error: unknown;

          try {
            await client.testUnary({}, {signal: abortController.signal});
          } catch (err) {
            error = err;
          }

          expect(isAbortError(error))
            .withContext(`Expected AbortError, got ${error}`)
            .toBe(true);

          await serverAbortDeferred.promise;
        }),
        Promise.resolve().then(async () => {
          await serverRequestStartDeferred.promise;

          abortController.abort();
        }),
      ]);
    });

    it('sends metadata', async function (this: Context) {
      const client = await this.init({
        async testUnary(request, context) {
          return {id: context.metadata.get('test')};
        },
      });

      expect(
        await client.testUnary(
          {},
          {
            metadata: Metadata({
              test: 'test-value',
            }),
          },
        ),
      ).toEqual({id: 'test-value'});
    });

    it('sends binary metadata', async function (this: Context) {
      const client = await this.init({
        async testUnary(request, context) {
          return {
            id: new TextDecoder().decode(context.metadata.get('test-bin')),
          };
        },
      });

      expect(
        await client.testUnary(
          {},
          {
            metadata: Metadata({
              'test-bin': new TextEncoder().encode('test-value'),
            }),
          },
        ),
      ).toEqual({id: 'test-value'});
    });

    if (
      process.env.FORCE_ALL_TESTS !== 'true' &&
      proxyType === 'grpcwebproxy' &&
      transport === 'fetch'
    ) {
      // grpcwebproxy does not support multiple values in metadata
    } else {
      it('sends binary metadata with multiple values', async function (this: Context) {
        const client = await this.init({
          async testUnary(request, context) {
            return {
              id: context.metadata
                .getAll('test-bin')
                .map(value => new TextDecoder().decode(value))
                .join(', '),
            };
          },
        });

        expect(
          await client.testUnary(
            {},
            {
              metadata: Metadata({
                'test-bin': [
                  new TextEncoder().encode('test-value-1'),
                  new TextEncoder().encode('test-value-2'),
                ],
              }),
            },
          ),
        ).toEqual({id: 'test-value-1, test-value-2'});
      });
    }

    if (
      process.env.FORCE_ALL_TESTS !== 'true' &&
      (environment?.name === 'chrome' || environment?.name === 'safari') &&
      transport === 'fetch'
    ) {
      // chrome and safari only receive headers after the first message is sent
    } else {
      it('receives early header', async function (this: Context) {
        const responseDeferred = defer<TestResponse>();

        const client = await this.init({
          async testUnary(request, context) {
            context.header.set('test', request.id);
            context.sendHeader();

            return await responseDeferred.promise;
          },
        });

        const headerDeferred = defer<Metadata>();

        await Promise.all([
          Promise.resolve().then(async () => {
            expect(
              await client.testUnary(
                {id: 'test-value'},
                {
                  onHeader(header) {
                    headerDeferred.resolve(header);
                  },
                },
              ),
            ).toEqual({id: 'test'});
          }),
          Promise.resolve().then(async () => {
            expect(
              await headerDeferred.promise.then(header => header.get('test')),
            ).toEqual('test-value');

            responseDeferred.resolve({id: 'test'});
          }),
        ]);
      });
    }

    it('receives binary header', async function (this: Context) {
      const client = await this.init({
        async testUnary(request, context) {
          context.header.set('test-bin', new TextEncoder().encode(request.id));

          return {};
        },
      });

      let header: Metadata | undefined;

      await client.testUnary(
        {id: 'test-value'},
        {
          onHeader(header_) {
            header = header_;
          },
        },
      );

      expect(header?.get('test-bin')).toEqual(
        new TextEncoder().encode('test-value'),
      );
    });

    it('receives binary header with multiple values', async function (this: Context) {
      const client = await this.init({
        async testUnary(request, context) {
          context.header.set('test-bin', [
            new TextEncoder().encode(`${request.id}-1`),
            new TextEncoder().encode(`${request.id}-2`),
          ]);

          return {};
        },
      });

      let header: Metadata | undefined;

      await client.testUnary(
        {id: 'test-value'},
        {
          onHeader(header_) {
            header = header_;
          },
        },
      );

      expect(header?.getAll('test-bin')).toEqual([
        new TextEncoder().encode('test-value-1'),
        new TextEncoder().encode('test-value-2'),
      ]);
    });

    it('receives binary trailer', async function (this: Context) {
      const client = await this.init({
        async testUnary(request, context) {
          context.trailer.set('test-bin', new TextEncoder().encode(request.id));

          return {};
        },
      });

      let trailer: Metadata | undefined;

      await client.testUnary(
        {id: 'test-value'},
        {
          onTrailer(trailer_) {
            trailer = trailer_;
          },
        },
      );

      expect(trailer?.get('test-bin')).toEqual(
        new TextEncoder().encode('test-value'),
      );
    });

    it('receives binary trailer with multiple values', async function (this: Context) {
      const client = await this.init({
        async testUnary(request, context) {
          context.trailer.set('test-bin', [
            new TextEncoder().encode(`${request.id}-1`),
            new TextEncoder().encode(`${request.id}-2`),
          ]);

          return {};
        },
      });

      let trailer: Metadata | undefined;

      await client.testUnary(
        {id: 'test-value'},
        {
          onTrailer(trailer_) {
            trailer = trailer_;
          },
        },
      );

      expect(trailer?.getAll('test-bin')).toEqual([
        new TextEncoder().encode('test-value-1'),
        new TextEncoder().encode('test-value-2'),
      ]);
    });
  });
});
