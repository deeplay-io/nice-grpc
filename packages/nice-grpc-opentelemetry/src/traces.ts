import {Span, trace} from '@opentelemetry/api';
import {
  MESSAGETYPEVALUES_RECEIVED,
  MESSAGETYPEVALUES_SENT,
  SEMATTRS_MESSAGE_ID,
  SEMATTRS_MESSAGE_TYPE,
} from '@opentelemetry/semantic-conventions';
import {VERSION} from './version';

export const tracer = trace.getTracer('nice-grpc-opentelemetry', VERSION);

/**
 * @param methodPath Full method path in form `/package.service/method`
 *
 * @see https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/#span-name
 */
export function getSpanName(methodPath: string): string {
  return methodPath.slice(1);
}

/**
 * Wrap call request or response iterable and emit `message` span event for each
 * item.
 *
 * @param iterable request or response iterable
 * @param span call span
 * @param type `SENT` or `RECEIVED`
 *
 * @see https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/#events
 */
export async function* emitSpanEvents<T>(
  iterable: AsyncIterable<T>,
  span: Span,
  type: typeof MESSAGETYPEVALUES_SENT | typeof MESSAGETYPEVALUES_RECEIVED,
): AsyncIterable<T> {
  let nextId = 1;

  for await (const item of iterable) {
    span.addEvent('message', {
      [SEMATTRS_MESSAGE_TYPE]: type,
      [SEMATTRS_MESSAGE_ID]: nextId++,
    });

    yield item;
  }
}
