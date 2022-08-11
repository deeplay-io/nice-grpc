import {SpanKind, SpanStatusCode} from '@opentelemetry/api';
import {tracing} from '@opentelemetry/sdk-node';

export function dumpSpan(span: tracing.ReadableSpan) {
  return {
    name: span.name,
    attributes: span.attributes,
    kind: SpanKind[span.kind],
    status: {
      code: SpanStatusCode[span.status.code],
      message: span.status.message,
    },
    events: span.events.map(event => ({
      name: event.name,
      attributes: event.attributes,
    })),
  };
}
