import getPort = require('get-port');
import defer = require('defer-promise');
import {forever, isAbortError} from 'abort-controller-x';
import {createServer, ServerError} from 'nice-grpc';
import {createChannel, createClient, Metadata, Status} from '..';
import {TestService} from '../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/grpc-js/test_pb';
import {Test} from '../../fixtures/grpc-web/test_pb_service';
import {startEnvoyProxy} from './utils/envoyProxy';
import {throwUnimplemented} from './utils/throwUnimplemented';
import {WebsocketTransport} from './utils/WebsocketTransport';
import {startGrptWebProxy} from './utils/grpcwebproxy';
import {FetchTransport} from './utils/FetchTransport';

describe.each([
  ['grpcwebproxy - fetch', startGrptWebProxy, FetchTransport],
  ['grpcwebproxy - websocket', startGrptWebProxy, WebsocketTransport],
  ['envoy - fetch', startEnvoyProxy, FetchTransport],
])('%s', (_, startProxy, Transport) => {
  test('basic', async () => {
    const server = createServer();

    server.add(TestService, {
      async testUnary(request: TestRequest) {
        return new TestResponse().setId(request.getId());
      },
      testServerStream: throwUnimplemented,
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const listenPort = await server.listen('0.0.0.0:0');

    const proxyPort = await getPort();
    const proxy = await startProxy(proxyPort, listenPort);

    const channel = createChannel(`http://localhost:${proxyPort}`, Transport());
    const client = createClient(Test, channel);

    await expect(client.testUnary(new TestRequest().setId('test'))).resolves
      .toMatchInlineSnapshot(`
            nice_grpc.test.TestResponse {
              "id": "test",
            }
          `);

    proxy.stop();
    await server.shutdown();
  });

  test('metadata', async () => {
    const server = createServer();

    const responseDeferred = defer<TestResponse>();

    server.add(TestService, {
      async testUnary(request: TestRequest, context) {
        const values = context.metadata.getAll('test');
        const binValues = context.metadata.getAll('test-bin');

        context.header.set('test', values);
        context.header.set('test-bin', binValues);

        context.sendHeader();

        const response = await responseDeferred.promise;

        context.trailer.set('test', values);
        context.trailer.set('test-bin', binValues);

        return response;
      },
      testServerStream: throwUnimplemented,
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const listenPort = await server.listen('0.0.0.0:0');

    const proxyPort = await getPort();
    const proxy = await startProxy(proxyPort, listenPort);

    const channel = createChannel(`http://localhost:${proxyPort}`, Transport());
    const client = createClient(Test, channel);

    const headerDeferred = defer<Metadata>();
    const trailerDeferred = defer<Metadata>();

    const metadata = Metadata();
    metadata.set('test', ['test-value-1', 'test-value-2']);
    metadata.set('test-bin', [new Uint8Array([1]), new Uint8Array([2])]);

    client.testUnary(new TestRequest(), {
      metadata,
      onHeader(header) {
        headerDeferred.resolve(header);
      },
      onTrailer(trailer) {
        trailerDeferred.resolve(trailer);
      },
    });

    await expect(headerDeferred.promise.then(header => header.getAll('test')))
      .resolves.toMatchInlineSnapshot(`
            Array [
              "test-value-1, test-value-2",
            ]
          `);
    await expect(
      headerDeferred.promise.then(header => header.getAll('test-bin')),
    ).resolves.toMatchInlineSnapshot(`
            Array [
              Uint8Array [
                1,
              ],
              Uint8Array [
                2,
              ],
            ]
          `);

    responseDeferred.resolve(new TestResponse());

    await expect(trailerDeferred.promise.then(header => header.getAll('test')))
      .resolves.toMatchInlineSnapshot(`
            Array [
              "test-value-1, test-value-2",
            ]
          `);
    await expect(
      trailerDeferred.promise.then(header => header.getAll('test-bin')),
    ).resolves.toMatchInlineSnapshot(`
            Array [
              Uint8Array [
                1,
              ],
              Uint8Array [
                2,
              ],
            ]
          `);

    proxy.stop();
    await server.shutdown();
  });

  test('error', async () => {
    const server = createServer();

    server.add(TestService, {
      async testUnary(request: TestRequest, context) {
        context.trailer.set('test', ['test-value-1', 'test-value-2']);
        throw new ServerError(Status.NOT_FOUND, request.getId());
      },
      testServerStream: throwUnimplemented,
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const listenPort = await server.listen('0.0.0.0:0');

    const proxyPort = await getPort();
    const proxy = await startProxy(proxyPort, listenPort);

    const channel = createChannel(`http://localhost:${proxyPort}`, Transport());
    const client = createClient(Test, channel);

    let trailer: Metadata | undefined;

    await expect(
      client.testUnary(new TestRequest().setId('test'), {
        onTrailer(metadata) {
          trailer = metadata;
        },
      }),
    ).rejects.toMatchInlineSnapshot(
      `[ClientError: /nice_grpc.test.Test/TestUnary NOT_FOUND: test]`,
    );

    expect(trailer?.getAll('test')).toMatchInlineSnapshot(`
      Array [
        "test-value-1, test-value-2",
      ]
    `);

    proxy.stop();
    await server.shutdown();
  });

  test('cancel', async () => {
    const server = createServer();

    const serverRequestStartDeferred = defer<void>();
    const serverAbortDeferred = defer<void>();

    server.add(TestService, {
      async testUnary(request: TestRequest, {signal}) {
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
      testServerStream: throwUnimplemented,
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const listenPort = await server.listen('0.0.0.0:0');

    const proxyPort = await getPort();
    const proxy = await startProxy(proxyPort, listenPort);

    const channel = createChannel(`http://localhost:${proxyPort}`, Transport());
    const client = createClient(Test, channel);

    const abortController = new AbortController();

    const promise = client.testUnary(new TestRequest(), {
      signal: abortController.signal,
    });

    await serverRequestStartDeferred.promise;

    abortController.abort();

    await expect(promise).rejects.toMatchInlineSnapshot(
      `[AbortError: The operation has been aborted]`,
    );

    await serverAbortDeferred.promise;

    proxy.stop();
    await server.shutdown();
  });
});
