import {SpanKind} from '@opentelemetry/api';
import {NodeSDK, tracing} from '@opentelemetry/sdk-node';
import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {openTelemetryClientMiddleware, openTelemetryServerMiddleware} from '..';
import {DeepPartial, TestDefinition, TestRequest} from '../../fixtures/test';
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
    testServerStream: throwUnimplemented,
    async testClientStream(request) {
      for await (const item of request) {
      }

      return {};
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  async function* createRequest(): AsyncIterable<DeepPartial<TestRequest>> {
    yield {};
    yield {};
  }

  await client.testClientStream(createRequest());

  await new Promise(resolve => setTimeout(resolve, 50));
  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(2);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    {
      "attributes": {
        "rpc.grpc.status_code": 0,
        "rpc.grpc.status_text": "OK",
        "rpc.method": "TestClientStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": [
        {
          "attributes": {
            "message.id": 1,
            "message.type": "SENT",
          },
          "name": "message",
        },
        {
          "attributes": {
            "message.id": 2,
            "message.type": "SENT",
          },
          "name": "message",
        },
      ],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestClientStream",
      "status": {
        "code": "UNSET",
        "message": undefined,
      },
    }
  `);

  expect('net.peer.port' in serverSpan.attributes).toBe(true);
  delete serverSpan.attributes['net.peer.port'];

  expect(dumpSpan(serverSpan)).toMatchInlineSnapshot(`
    {
      "attributes": {
        "net.peer.ip": "127.0.0.1",
        "rpc.grpc.status_code": 0,
        "rpc.grpc.status_text": "OK",
        "rpc.method": "TestClientStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": [
        {
          "attributes": {
            "message.id": 1,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
        {
          "attributes": {
            "message.id": 2,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
      ],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestClientStream",
      "status": {
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
    testServerStream: throwUnimplemented,
    async testClientStream(request) {
      for await (const item of request) {
      }

      throw new ServerError(Status.NOT_FOUND, 'test error message');
    },
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClientFactory()
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  async function* createRequest(): AsyncIterable<DeepPartial<TestRequest>> {
    yield {};
    yield {};
  }

  await client.testClientStream(createRequest()).catch(() => {});

  await new Promise(resolve => setTimeout(resolve, 50));
  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(2);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    {
      "attributes": {
        "rpc.grpc.status_code": 5,
        "rpc.grpc.status_text": "NOT_FOUND",
        "rpc.method": "TestClientStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": [
        {
          "attributes": {
            "message.id": 1,
            "message.type": "SENT",
          },
          "name": "message",
        },
        {
          "attributes": {
            "message.id": 2,
            "message.type": "SENT",
          },
          "name": "message",
        },
      ],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestClientStream",
      "status": {
        "code": "ERROR",
        "message": "NOT_FOUND: test error message",
      },
    }
  `);

  expect('net.peer.port' in serverSpan.attributes).toBe(true);
  delete serverSpan.attributes['net.peer.port'];

  expect(dumpSpan(serverSpan)).toMatchInlineSnapshot(`
    {
      "attributes": {
        "net.peer.ip": "127.0.0.1",
        "rpc.grpc.status_code": 5,
        "rpc.grpc.status_text": "NOT_FOUND",
        "rpc.method": "TestClientStream",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": [
        {
          "attributes": {
            "message.id": 1,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
        {
          "attributes": {
            "message.id": 2,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
      ],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestClientStream",
      "status": {
        "code": "ERROR",
        "message": "NOT_FOUND: test error message",
      },
    }
  `);

  channel.close();

  await server.shutdown();
});
