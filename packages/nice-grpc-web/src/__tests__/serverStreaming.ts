import getPort = require('get-port');
import defer = require('defer-promise');
import {forever, isAbortError} from 'abort-controller-x';
import {createServer, ServerError} from 'nice-grpc';
import {createChannel, createClient, Metadata, Status} from '..';
import {TestService} from '../../fixtures/grpc-js/test_grpc_pb';
import {TestRequest, TestResponse} from '../../fixtures/grpc-js/test_pb';
import {Test} from '../../fixtures/grpc-web/test_pb_service';
import {startGrpcWebProxy} from './utils/grpcwebproxy';
import {throwUnimplemented} from './utils/throwUnimplemented';
import {WebsocketTransport} from './utils/WebsocketTransport';
import {startEnvoyProxy} from './utils/envoyProxy';
import {FetchTransport} from './utils/FetchTransport';

describe.each([
  ['grpcwebproxy - fetch', startGrpcWebProxy, FetchTransport],
  ['grpcwebproxy - websocket', startGrpcWebProxy, WebsocketTransport],
  ['envoy - fetch', startEnvoyProxy, FetchTransport],
])('%s', (_, startProxy, Transport) => {
  test('basic', async () => {
    const server = createServer();

    server.add(TestService, {
      async *testServerStream(request: TestRequest, context) {
        yield new TestResponse().setId(`${request.getId()}-1`);
        yield new TestResponse().setId(`${request.getId()}-2`);
      },
      testUnary: throwUnimplemented,
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const listenPort = await server.listen('0.0.0.0:0');

    const proxyPort = await getPort();
    const proxy = await startProxy(proxyPort, listenPort);

    const channel = createChannel(`http://localhost:${proxyPort}`, Transport());
    const client = createClient(Test, channel);

    const responses: any[] = [];

    for await (const response of client.testServerStream(
      new TestRequest().setId('test'),
    )) {
      responses.push(response);
    }

    expect(responses).toMatchInlineSnapshot(`
      Array [
        nice_grpc.test.TestResponse {
          "id": "test-1",
        },
        nice_grpc.test.TestResponse {
          "id": "test-2",
        },
      ]
    `);

    proxy.stop();
    await server.shutdown();
  }, 15_000);

  test('metadata', async () => {
    const server = createServer();

    const responseDeferred = defer<void>();

    server.add(TestService, {
      testUnary: throwUnimplemented,
      async *testServerStream(request: TestRequest, context) {
        const values = context.metadata.getAll('test');

        context.header.set('test', values);

        context.sendHeader();

        await responseDeferred.promise;

        context.trailer.set('test', values);
      },
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
    metadata.append('test', 'test-value-1');
    metadata.append('test', 'test-value-2');

    const promise = Promise.resolve().then(async () => {
      const responses: any[] = [];

      const iterable = client.testServerStream(new TestRequest(), {
        metadata,
        onHeader(header) {
          headerDeferred.resolve(header);
        },
        onTrailer(trailer) {
          trailerDeferred.resolve(trailer);
        },
      });

      for await (const response of iterable) {
        responses.push(response);
      }

      return responses;
    });

    await expect(headerDeferred.promise.then(header => header.getAll('test')))
      .resolves.toMatchInlineSnapshot(`
            Array [
              "test-value-1, test-value-2",
            ]
          `);

    responseDeferred.resolve();

    await expect(promise).resolves.toMatchInlineSnapshot(`Array []`);

    await expect(trailerDeferred.promise.then(header => header.getAll('test')))
      .resolves.toMatchInlineSnapshot(`
            Array [
              "test-value-1, test-value-2",
            ]
          `);

    proxy.stop();
    await server.shutdown();
  });

  test('error', async () => {
    const server = createServer();

    server.add(TestService, {
      testUnary: throwUnimplemented,
      async *testServerStream(request: TestRequest, context) {
        yield new TestResponse().setId(request.getId());

        context.trailer.set('test', 'test-value');
        throw new ServerError(Status.ABORTED, 'test');
      },
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const listenPort = await server.listen('0.0.0.0:0');

    const proxyPort = await getPort();
    const proxy = await startProxy(proxyPort, listenPort);

    const channel = createChannel(`http://localhost:${proxyPort}`, Transport());
    const client = createClient(Test, channel);

    const responses: any[] = [];
    let trailer: Metadata | undefined;

    try {
      for await (const response of client.testServerStream(
        new TestRequest().setId('test'),
        {
          onTrailer(metadata) {
            trailer = metadata;
          },
        },
      )) {
        responses.push({type: 'response', response: response});
      }
    } catch (error) {
      responses.push({type: 'error', error});
    }

    expect(responses).toMatchInlineSnapshot(`
      Array [
        Object {
          "response": nice_grpc.test.TestResponse {
            "id": "test",
          },
          "type": "response",
        },
        Object {
          "error": [ClientError: /nice_grpc.test.Test/TestServerStream ABORTED: test],
          "type": "error",
        },
      ]
    `);

    expect(trailer?.getAll('test')).toMatchInlineSnapshot(`
      Array [
        "test-value",
      ]
    `);

    proxy.stop();
    await server.shutdown();
  });

  test('cancel', async () => {
    const server = createServer();

    const serverAbortDeferred = defer<void>();

    server.add(TestService, {
      testUnary: throwUnimplemented,
      async *testServerStream(request: TestRequest, {signal}) {
        yield new TestResponse().setId(request.getId());

        try {
          return await forever(signal);
        } catch (err) {
          if (isAbortError(err)) {
            serverAbortDeferred.resolve();
          }

          throw err;
        }
      },
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const listenPort = await server.listen('0.0.0.0:0');

    const proxyPort = await getPort();
    const proxy = await startProxy(proxyPort, listenPort);

    const channel = createChannel(`http://localhost:${proxyPort}`, Transport());
    const client = createClient(Test, channel);

    const abortController = new AbortController();

    const iterable = client.testServerStream(new TestRequest().setId('test'), {
      signal: abortController.signal,
    });

    const responses: any[] = [];

    try {
      for await (const response of iterable) {
        responses.push({type: 'response', response: response});
        abortController.abort();
      }
    } catch (error) {
      responses.push({type: 'error', error});
    }

    expect(responses).toMatchInlineSnapshot(`
      Array [
        Object {
          "response": nice_grpc.test.TestResponse {
            "id": "test",
          },
          "type": "response",
        },
        Object {
          "error": [AbortError: The operation has been aborted],
          "type": "error",
        },
      ]
    `);

    await serverAbortDeferred.promise;

    proxy.stop();
    await server.shutdown();
  });

  test('high rate', async () => {
    const count = 10_000;

    const server = createServer();

    server.add(TestService, {
      testUnary: throwUnimplemented,
      async *testServerStream(request: TestRequest) {
        for (let i = 0; i < count; i++) {
          yield new TestResponse().setId(`${i}`);
        }
      },
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const listenPort = await server.listen('0.0.0.0:0');

    const proxyPort = await getPort();
    const proxy = await startProxy(proxyPort, listenPort);

    const channel = createChannel(`http://localhost:${proxyPort}`, Transport());
    const client = createClient(Test, channel);

    let i = 0;

    for await (const response of client.testServerStream(new TestRequest())) {
      expect(response.getId()).toBe(`${i++}`);
    }

    expect(i).toBe(count);

    proxy.stop();
    await server.shutdown();
  });
});
