import {MethodDescriptor} from 'nice-grpc-common';
import {Counter, exponentialBuckets} from 'prom-client';

export const typeLabel = 'grpc_type';
export const serviceLabel = 'grpc_service';
export const methodLabel = 'grpc_method';
export const pathLabel = 'grpc_path';
export const codeLabel = 'grpc_code';

/**
 * 1ms, 4ms, 16ms, ..., ~1 hour in seconds
 */
export const latencySecondsBuckets = exponentialBuckets(0.001, 4, 12);
export const labelNames = [typeLabel, serviceLabel, methodLabel, pathLabel];
export const labelNamesWithCode = [...labelNames, codeLabel];

export function getLabels(method: MethodDescriptor) {
  const callType = method.requestStream
    ? method.responseStream
      ? 'bidi_stream'
      : 'client_stream'
    : method.responseStream
    ? 'server_stream'
    : 'unary';

  const {path} = method;

  const [serviceName, methodName] = path.split('/').slice(1);

  return {
    [typeLabel]: callType,
    [serviceLabel]: serviceName,
    [methodLabel]: methodName,
    [pathLabel]: path,
  };
}

export async function* incrementStreamMessagesCounter<T>(
  iterable: AsyncIterable<T>,
  counter: Counter.Internal,
): AsyncIterable<T> {
  for await (const item of iterable) {
    counter.inc();

    yield item;
  }
}
