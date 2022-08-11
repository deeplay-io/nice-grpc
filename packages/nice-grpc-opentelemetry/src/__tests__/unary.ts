import {SpanKind} from '@opentelemetry/api';
import {NodeSDK, tracing} from '@opentelemetry/sdk-node';
import {forever} from 'abort-controller-x';
import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {openTelemetryClientMiddleware, openTelemetryServerMiddleware} from '..';
import {TestDefinition} from '../../fixtures/test';
import {dumpSpan} from './utils/dumpSpan';
import {throwUnimplemented} from './utils/throwUnimplemented';
import defer = require('defer-promise');

const traceExporter = new tracing.InMemorySpanExporter();

const sdk = new NodeSDK({
  spanLimits: {},
  spanProcessor: new tracing.SimpleSpanProcessor(traceExporter),
});

beforeAll(async () => {
  await sdk.start();
});

afterAll(async () => {
  await sdk.shutdown();
});

afterEach(() => {
  traceExporter.reset();
});

test('basic', async () => {
  const server = createServer().use(openTelemetryServerMiddleware());

  server.add(TestDefinition, {
    async testUnary() {
      return {};
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  await client.testUnary({});

  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(2);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "rpc.grpc.status_code": 0,
        "rpc.grpc.status_text": "OK",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "UNSET",
        "message": undefined,
      },
    }
  `);

  expect('net.peer.port' in serverSpan.attributes).toBe(true);
  delete serverSpan.attributes['net.peer.port'];

  expect(dumpSpan(serverSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "net.peer.ip": "::1",
        "rpc.grpc.status_code": 0,
        "rpc.grpc.status_text": "OK",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "UNSET",
        "message": undefined,
      },
    }
  `);

  channel.close();

  await server.shutdown();
});

test('error', async () => {
  const server = createServer().use(openTelemetryServerMiddleware());

  server.add(TestDefinition, {
    async testUnary() {
      throw new ServerError(Status.NOT_FOUND, 'test error message');
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  await client.testUnary({}).catch(() => {});

  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(2);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "rpc.grpc.status_code": 5,
        "rpc.grpc.status_text": "NOT_FOUND",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "ERROR",
        "message": "NOT_FOUND: test error message",
      },
    }
  `);

  expect('net.peer.port' in serverSpan.attributes).toBe(true);
  delete serverSpan.attributes['net.peer.port'];

  expect(dumpSpan(serverSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "net.peer.ip": "::1",
        "rpc.grpc.status_code": 5,
        "rpc.grpc.status_text": "NOT_FOUND",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "ERROR",
        "message": "NOT_FOUND: test error message",
      },
    }
  `);

  channel.close();

  await server.shutdown();
});

test('unknown error', async () => {
  const server = createServer().use(openTelemetryServerMiddleware());

  server.add(TestDefinition, {
    async testUnary() {
      throw new Error('test error message');
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  await client.testUnary({}).catch(() => {});

  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(2);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "rpc.grpc.status_code": 2,
        "rpc.grpc.status_text": "UNKNOWN",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "ERROR",
        "message": "UNKNOWN: Unknown server error occurred",
      },
    }
  `);

  expect(serverSpan.attributes['net.peer.port'] != null).toBe(true);
  delete serverSpan.attributes['net.peer.port'];

  expect(
    serverSpan.events[0]?.attributes?.['exception.stacktrace'] != null,
  ).toBe(true);
  delete serverSpan.events[0]?.attributes?.['exception.stacktrace'];

  expect(dumpSpan(serverSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "net.peer.ip": "::1",
        "rpc.grpc.status_code": 2,
        "rpc.grpc.status_text": "UNKNOWN",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "exception.message": "test error message",
            "exception.type": "Error",
          },
          "name": "exception",
        },
      ],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "ERROR",
        "message": "UNKNOWN: Unknown server error occurred",
      },
    }
  `);

  channel.close();

  await server.shutdown();
});

test('cancel', async () => {
  const server = createServer().use(openTelemetryServerMiddleware());

  const serverRequestStartDeferred = defer<void>();

  server.add(TestDefinition, {
    async testUnary(request, {signal}) {
      serverRequestStartDeferred.resolve();

      return await forever(signal);
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  const abortController = new AbortController();

  client.testUnary({}, {signal: abortController.signal}).catch(() => {});

  await serverRequestStartDeferred.promise;

  abortController.abort();

  await new Promise(resolve => setTimeout(resolve, 100));

  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(2);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "rpc.grpc.status_code": 1,
        "rpc.grpc.status_text": "CANCELLED",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "ERROR",
        "message": "CANCELLED: The operation was cancelled",
      },
    }
  `);

  expect('net.peer.port' in serverSpan.attributes).toBe(true);
  delete serverSpan.attributes['net.peer.port'];

  expect(dumpSpan(serverSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "net.peer.ip": "::1",
        "rpc.grpc.status_code": 1,
        "rpc.grpc.status_text": "CANCELLED",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "ERROR",
        "message": "CANCELLED: The operation was cancelled",
      },
    }
  `);

  channel.close();

  await server.shutdown();
});
