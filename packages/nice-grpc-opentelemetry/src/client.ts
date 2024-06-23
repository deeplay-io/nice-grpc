import {
  context as contextApi,
  propagation,
  Span,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import {
  MESSAGETYPEVALUES_RECEIVED,
  MESSAGETYPEVALUES_SENT,
} from '@opentelemetry/semantic-conventions';
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
import {metadataSetter} from './propagation';
import {emitSpanEvents, getSpanName, tracer} from './traces';
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

  let settled = false;
  let status: Status = Status.OK;
  let errorMessage: string | undefined;

  try {
    let request;

    if (!call.requestStream) {
      request = call.request;
    } else {
      request = emitSpanEvents(call.request, span, MESSAGETYPEVALUES_SENT);
    }

    if (!call.responseStream) {
      const response = yield* call.next(request, options);

      settled = true;

      return response;
    } else {
      yield* emitSpanEvents(
        call.next(request, options),
        span,
        MESSAGETYPEVALUES_RECEIVED,
      );

      settled = true;

      return;
    }
  } catch (err: unknown) {
    settled = true;

    if (err instanceof ClientError) {
      status = err.code;
      errorMessage = err.details;
    } else if (isAbortError(err)) {
      status = Status.CANCELLED;
      errorMessage = 'The operation was cancelled';
    } else {
      status = Status.UNKNOWN;
      errorMessage = 'Unknown server error occurred';

      span.recordException(err as any);
    }

    throw err;
  } finally {
    if (!settled) {
      status = Status.CANCELLED;
      errorMessage =
        'Stream iteration was aborted by client, e.g. by breaking from the for .. of loop';
    }

    const statusAttributes = getStatusAttributes(status);

    span.setAttributes(statusAttributes);

    // https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/#grpc-status
    if (status !== Status.OK) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `${Status[status]}: ${errorMessage}`,
      });
    }

    span.end();
  }
}
