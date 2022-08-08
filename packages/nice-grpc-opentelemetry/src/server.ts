import {
  context as contextApi,
  propagation,
  ROOT_CONTEXT,
  Span,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import {MessageTypeValues} from '@opentelemetry/semantic-conventions';
import {isAbortError} from 'abort-controller-x';
import {
  CallContext,
  ServerError,
  ServerMiddleware,
  ServerMiddlewareCall,
  Status,
} from 'nice-grpc-common';
import {
  getMethodAttributes,
  getPeerAttributes,
  getStatusAttributes,
} from './attributes';
import {metadataGetter} from './propagation';
import {bindAsyncGenerator} from './utils/bindAsyncGenerator';
import {tracer} from './traces';
import {emitSpanEvent, emitSpanEvents, getSpanName} from './traces';

export function openTelemetryServerMiddleware(): ServerMiddleware {
  return (call, context) =>
    tracer.startActiveSpan(
      getSpanName(call.method.path),
      {
        kind: SpanKind.SERVER,
      },
      propagation.extract(ROOT_CONTEXT, context.metadata, metadataGetter),
      span =>
        bindAsyncGenerator(
          contextApi.active(),
          openTelemetryServerMiddlewareGenerator(span, call, context),
        ),
    );
}

async function* openTelemetryServerMiddlewareGenerator<Request, Response>(
  span: Span,
  call: ServerMiddlewareCall<Request, Response>,
  context: CallContext,
): AsyncGenerator<Response, Response | void, undefined> {
  const {
    countMessagesPerRpc,
    serverActiveRpcsMetric,
    serverDurationMetric,
    serverRequestsPerRpcMetric,
    serverResponsesPerRpcMetric,
  } = await import('./metrics');

  const attributes = {
    ...getMethodAttributes(call.method.path),
    ...getPeerAttributes(context.peer),
  };

  span.setAttributes(attributes);
  const startTimeMs = performance.now();
  serverActiveRpcsMetric.add(1, attributes);

  let status: Status = Status.OK;
  let message: string | undefined;

  try {
    let request;

    if (!call.requestStream) {
      request = call.request;

      emitSpanEvent(span, MessageTypeValues.RECEIVED);
      serverRequestsPerRpcMetric.record(1, attributes);
    } else {
      request = countMessagesPerRpc(
        emitSpanEvents(call.request, span, MessageTypeValues.RECEIVED),
        count => {
          serverRequestsPerRpcMetric.record(count, attributes);
        },
      );
    }

    if (!call.responseStream) {
      const response = yield* call.next(request, context);

      emitSpanEvent(span, MessageTypeValues.SENT);
      serverResponsesPerRpcMetric.record(1, attributes);

      return response;
    } else {
      yield* countMessagesPerRpc(
        emitSpanEvents(
          call.next(request, context),
          span,
          MessageTypeValues.SENT,
        ),
        count => {
          serverResponsesPerRpcMetric.record(count, attributes);
        },
      );

      return;
    }
  } catch (err: unknown) {
    if (err instanceof ServerError) {
      status = err.code;
      message = err.details;
    } else if (isAbortError(err)) {
      status = Status.CANCELLED;
    } else {
      status = Status.UNKNOWN;

      span.recordException(err as any);
    }

    throw err;
  } finally {
    serverActiveRpcsMetric.add(-1, attributes);
    const durationMs = performance.now() - startTimeMs;

    const statusAttributes = getStatusAttributes(status);

    serverDurationMetric.record(durationMs, {
      ...attributes,
      ...statusAttributes,
    });
    span.setAttributes(statusAttributes);

    // https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/#grpc-status
    if (status !== Status.OK) {
      span.setStatus({code: SpanStatusCode.ERROR, message});
    }

    span.end();
  }
}
