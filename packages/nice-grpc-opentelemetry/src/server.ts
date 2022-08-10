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
import {emitSpanEvents, getSpanName} from './traces';

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
  const attributes = {
    ...getMethodAttributes(call.method.path),
    ...getPeerAttributes(context.peer),
  };

  span.setAttributes(attributes);

  let status: Status = Status.OK;
  let errorMessage: string | undefined;

  try {
    let request;

    if (!call.requestStream) {
      request = call.request;
    } else {
      request = emitSpanEvents(call.request, span, MessageTypeValues.RECEIVED);
    }

    if (!call.responseStream) {
      return yield* call.next(request, context);
    } else {
      yield* emitSpanEvents(
        call.next(request, context),
        span,
        MessageTypeValues.SENT,
      );

      return;
    }
  } catch (err: unknown) {
    if (err instanceof ServerError) {
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
