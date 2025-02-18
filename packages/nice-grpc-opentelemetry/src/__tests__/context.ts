import {context, SpanKind, trace} from '@opentelemetry/api';
import {NodeSDK, tracing} from '@opentelemetry/sdk-node';
import {createChannel, createClientFactory, createServer} from 'nice-grpc';
import {openTelemetryClientMiddleware, openTelemetryServerMiddleware} from '..';
import {TestDefinition} from '../../fixtures/test';
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

test('context propagation', async () => {
  function getCurrentTraceId() {
    return trace.getSpanContext(context.active())?.traceId;
  }

  let traceIdInServerMiddlewareStart: string | undefined;
  let traceIdInServerMiddlewareEnd: string | undefined;
  let traceIdInMethodImpl: string | undefined;
  let traceIdInClientMiddlewareStart: string | undefined;
  let traceIdInClientMiddlewareEnd: string | undefined;

  const server = createServer()
    .use(openTelemetryServerMiddleware())
    .use(async function* testServerMiddleware(call, context) {
      traceIdInServerMiddlewareStart = getCurrentTraceId();

      const result = yield* call.next(call.request, context);

      traceIdInServerMiddlewareEnd = getCurrentTraceId();

      return result;
    });

  server.add(TestDefinition, {
    async testUnary() {
      traceIdInMethodImpl = getCurrentTraceId();

      return {};
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClientFactory()
    .use(async function* testClientMiddleware(call, options) {
      traceIdInClientMiddlewareStart = getCurrentTraceId();

      const result = yield* call.next(call.request, options);

      traceIdInClientMiddlewareEnd = getCurrentTraceId();

      return result;
    })
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  const testTracer = trace.getTracer('test');

  let traceId: string | undefined;

  await testTracer.startActiveSpan('test-span', async span => {
    traceId = span.spanContext().traceId;

    try {
      await client.testUnary({});
    } finally {
      span.end();
    }
  });

  expect(traceId).toBeDefined();

  expect(traceIdInServerMiddlewareStart).toEqual(traceId);
  expect(traceIdInServerMiddlewareEnd).toEqual(traceId);
  expect(traceIdInMethodImpl).toEqual(traceId);
  expect(traceIdInClientMiddlewareStart).toEqual(traceId);
  expect(traceIdInClientMiddlewareEnd).toEqual(traceId);

  await new Promise(resolve => setTimeout(resolve, 50));
  const finishedSpans = traceExporter.getFinishedSpans();
  expect(finishedSpans).toHaveLength(3);
  const serverSpan = finishedSpans.find(span => span.kind === SpanKind.SERVER)!;
  const clientSpan = finishedSpans.find(span => span.kind === SpanKind.CLIENT)!;

  expect(serverSpan.spanContext().traceId).toEqual(traceId);
  expect(clientSpan.spanContext().traceId).toEqual(traceId);

  channel.close();

  await server.shutdown();
});
