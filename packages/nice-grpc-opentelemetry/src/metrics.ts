import {metrics, ValueType} from '@opentelemetry/api-metrics';
import {VERSION} from './version';

export const meter = metrics.getMeter('nice-grpc-opentelemetry', VERSION);

/**
 * @see https://opentelemetry.io/docs/reference/specification/metrics/semantic_conventions/rpc/#rpc-server
 */
export const serverDurationMetric = meter.createHistogram(
  'rpc.server.duration',
  {
    description: 'measures duration of inbound RPC',
    unit: 'milliseconds',
    valueType: ValueType.DOUBLE,
  },
);

/**
 * @see https://opentelemetry.io/docs/reference/specification/metrics/semantic_conventions/rpc/#rpc-server
 */
export const serverRequestsPerRpcMetric = meter.createHistogram(
  'rpc.server.requests_per_rpc',
  {
    description:
      'measures the number of messages received by server per RPC. Should be 1 for all non-streaming RPCs',
    unit: 'count',
    valueType: ValueType.INT,
  },
);

/**
 * @see https://opentelemetry.io/docs/reference/specification/metrics/semantic_conventions/rpc/#rpc-server
 */
export const serverResponsesPerRpcMetric = meter.createHistogram(
  'rpc.server.responses_per_rpc',
  {
    description:
      'measures the number of messages sent by server per RPC. Should be 1 for all non-streaming RPCs',
    unit: 'count',
    valueType: ValueType.INT,
  },
);

export const serverActiveRpcsMetric = meter.createUpDownCounter(
  'rpc.server.active_rpcs',
  {
    description:
      'measures the number of concurrent RPCs that are currently in-flight',
    unit: 'rpcs',
    valueType: ValueType.INT,
  },
);

/**
 * @see https://opentelemetry.io/docs/reference/specification/metrics/semantic_conventions/rpc/#rpc-client
 */
export const clientDurationMetric = meter.createHistogram(
  'rpc.client.duration',
  {
    description: 'measures duration of outbound RPC',
    unit: 'milliseconds',
    valueType: ValueType.DOUBLE,
  },
);

/**
 * @see https://opentelemetry.io/docs/reference/specification/metrics/semantic_conventions/rpc/#rpc-client
 */
export const clientRequestsPerRpcMetric = meter.createHistogram(
  'rpc.client.requests_per_rpc',
  {
    description:
      'measures the number of messages sent by client per RPC. Should be 1 for all non-streaming RPCs',
    unit: 'count',
    valueType: ValueType.INT,
  },
);

/**
 * @see https://opentelemetry.io/docs/reference/specification/metrics/semantic_conventions/rpc/#rpc-client
 */
export const clientResponsesPerRpcMetric = meter.createHistogram(
  'rpc.client.responses_per_rpc',
  {
    description:
      'measures the number of messages received by client per RPC. Should be 1 for all non-streaming RPCs',
    unit: 'count',
    valueType: ValueType.INT,
  },
);

export const clientActiveRpcsMetric = meter.createUpDownCounter(
  'rpc.client.active_rpcs',
  {
    description:
      'measures the number of concurrent RPCs that are currently in-flight',
    unit: 'rpcs',
    valueType: ValueType.INT,
  },
);

export async function* countMessagesPerRpc<T>(
  iterable: AsyncIterable<T>,
  onCount: (count: number) => void,
): AsyncIterable<T> {
  let count = 0;

  try {
    for await (const item of iterable) {
      count += 1;

      yield item;
    }
  } finally {
    onCount(count);
  }
}
