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
    testUnary: throwUnimplemented,
    async *testServerStream() {
      yield {};
      yield {};
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  for await (const response of client.testServerStream({})) {
  }

  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(2);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "rpc.grpc.status_code": 0,
        "rpc.grpc.status_text": "OK",
        "rpc.method": "TestServerStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
        Object {
          "attributes": Object {
            "message.id": 2,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
      ],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestServerStream",
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
        "rpc.method": "TestServerStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "SENT",
          },
          "name": "message",
        },
        Object {
          "attributes": Object {
            "message.id": 2,
            "message.type": "SENT",
          },
          "name": "message",
        },
      ],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestServerStream",
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
    testUnary: throwUnimplemented,
    async *testServerStream() {
      yield {};
      throw new ServerError(Status.NOT_FOUND, 'test error message');
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  await Promise.resolve()
    .then(async () => {
      for await (const response of client.testServerStream({})) {
      }
    })
    .catch(() => {});

  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(2);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "rpc.grpc.status_code": 5,
        "rpc.grpc.status_text": "NOT_FOUND",
        "rpc.method": "TestServerStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
      ],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestServerStream",
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
        "rpc.method": "TestServerStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "SENT",
          },
          "name": "message",
        },
      ],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestServerStream",
      "status": Object {
        "code": "ERROR",
        "message": "NOT_FOUND: test error message",
      },
    }
  `);

  channel.close();

  await server.shutdown();
});

test('aborted iteration on client', async () => {
  const server = createServer().use(openTelemetryServerMiddleware());

  server.add(TestDefinition, {
    testUnary: throwUnimplemented,
    async *testServerStream(request, {signal}) {
      yield {};
      return await forever(signal);
    },
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  for await (const response of client.testServerStream({})) {
    break;
  }

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
        "rpc.method": "TestServerStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
      ],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestServerStream",
      "status": Object {
        "code": "ERROR",
        "message": "CANCELLED: Stream iteration was aborted by client, e.g. by breaking from the for .. of loop",
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
        "rpc.method": "TestServerStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "SENT",
          },
          "name": "message",
        },
      ],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestServerStream",
      "status": Object {
        "code": "ERROR",
        "message": "CANCELLED: The operation was cancelled",
      },
    }
  `);

  channel.close();

  await server.shutdown();
});
