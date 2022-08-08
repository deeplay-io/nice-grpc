import {
  context as contextApi,
  propagation,
  Span,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import {MessageTypeValues} from '@opentelemetry/semantic-conventions';
import {isAbortError} from 'abort-controller-x';
import {
  CallOptions,
  ClientError,
  ClientMiddleware,
  ClientMiddlewareCall,
  Metadata,
  Status,
} from 'nice-grpc-common';
import {getMethodAttributes, getStatusAttributes} from './attributes';
import {
  clientActiveRpcsMetric,
  clientDurationMetric,
  clientRequestsPerRpcMetric,
  clientResponsesPerRpcMetric,
  countMessagesPerRpc,
} from './metrics';
import {metadataSetter} from './propagation';
import {emitSpanEvent, emitSpanEvents, getSpanName, tracer} from './traces';
import {bindAsyncGenerator} from './utils/bindAsyncGenerator';

export function openTelemetryClientMiddleware(): ClientMiddleware {
  return (call, options) =>
    tracer.startActiveSpan(
      getSpanName(call.method.path),
      {
        kind: SpanKind.CLIENT,
      },
      span => {
        const metadata = Metadata(options.metadata);

        propagation.inject(contextApi.active(), metadata, metadataSetter);

        return bindAsyncGenerator(
          contextApi.active(),
          openTelemetryClientMiddlewareGenerator(span, call, {
            ...options,
            metadata,
          }),
        );
      },
    );
}

async function* openTelemetryClientMiddlewareGenerator<Request, Response>(
  span: Span,
  call: ClientMiddlewareCall<Request, Response>,
  options: CallOptions,
): AsyncGenerator<Response, Response | void, undefined> {
  const attributes = getMethodAttributes(call.method.path);

  span.setAttributes(attributes);
  const startTimeMs = performance.now();
  clientActiveRpcsMetric.add(1, attributes);

  let status: Status = Status.OK;
  let message: string | undefined;

  try {
    let request;

    if (!call.requestStream) {
      request = call.request;

      emitSpanEvent(span, MessageTypeValues.RECEIVED);
      clientRequestsPerRpcMetric.record(1, attributes);
    } else {
      request = countMessagesPerRpc(
        emitSpanEvents(call.request, span, MessageTypeValues.RECEIVED),
        count => {
          clientRequestsPerRpcMetric.record(count, attributes);
        },
      );
    }

    if (!call.responseStream) {
      const response = yield* call.next(request, options);

      emitSpanEvent(span, MessageTypeValues.SENT);
      clientResponsesPerRpcMetric.record(1, attributes);

      return response;
    } else {
      yield* countMessagesPerRpc(
        emitSpanEvents(
          call.next(request, options),
          span,
          MessageTypeValues.SENT,
        ),
        count => {
          clientResponsesPerRpcMetric.record(count, attributes);
        },
      );

      return;
    }
  } catch (err: unknown) {
    if (err instanceof ClientError) {
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
    clientActiveRpcsMetric.add(-1, attributes);
    const durationMs = performance.now() - startTimeMs;

    const statusAttributes = getStatusAttributes(status);

    clientDurationMetric.record(durationMs, {
      ...attributes,
      ...statusAttributes,
    });
    span.setAttributes(statusAttributes);

    if (status !== Status.OK) {
      span.setStatus({code: SpanStatusCode.ERROR, message});
    }

    span.end();
  }
}
