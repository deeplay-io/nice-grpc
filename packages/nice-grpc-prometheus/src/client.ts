import {isAbortError} from 'abort-controller-x';
import {
  CallOptions,
  ClientError,
  ClientMiddleware,
  ClientMiddlewareCall,
  Status,
} from 'nice-grpc-common';
import {Counter, Histogram} from 'prom-client';
import {
  codeLabel,
  getLabels,
  incrementStreamMessagesCounter,
  labelNames,
  labelNamesWithCode,
  latencySecondsBuckets,
  methodLabel,
  pathLabel,
  serviceLabel,
  typeLabel,
} from './common';
import {registry} from './registry';

const defaultClientStartedMetric = new Counter({
  registers: [registry],
  name: 'grpc_client_started_total',
  help: 'Total number of RPCs started on the client.',
  labelNames,
});

const defaultClientHandledMetric = new Counter({
  registers: [registry],
  name: 'grpc_client_handled_total',
  help: 'Total number of RPCs completed on the client, regardless of success or failure.',
  labelNames: labelNamesWithCode,
});

const defaultClientStreamMsgReceivedMetric = new Counter({
  registers: [registry],
  name: 'grpc_client_msg_received_total',
  help: 'Total number of RPC stream messages received by the client.',
  labelNames,
});

const defaultClientStreamMsgSentMetric = new Counter({
  registers: [registry],
  name: 'grpc_client_msg_sent_total',
  help: 'Total number of gRPC stream messages sent by the client.',
  labelNames,
});

const defaultClientHandlingSecondsMetric = new Histogram({
  registers: [registry],
  name: 'grpc_client_handling_seconds',
  help: 'Histogram of response latency (seconds) of the gRPC until it is finished by the application.',
  labelNames: labelNamesWithCode,
  buckets: latencySecondsBuckets,
});

type PrometheusClientMiddlewareOptions = {
  clientStartedMetric?: Counter<
    | typeof typeLabel
    | typeof serviceLabel
    | typeof methodLabel
    | typeof pathLabel
  >;
  clientHandledMetric?: Counter<
    | typeof typeLabel
    | typeof serviceLabel
    | typeof methodLabel
    | typeof pathLabel
    | typeof codeLabel
  >;
  clientStreamMsgReceivedMetric?: Counter<
    | typeof typeLabel
    | typeof serviceLabel
    | typeof methodLabel
    | typeof pathLabel
  >;
  clientStreamMsgSentMetric?: Counter<
    | typeof typeLabel
    | typeof serviceLabel
    | typeof methodLabel
    | typeof pathLabel
  >;
  clientHandlingSecondsMetric?: Histogram<
    | typeof typeLabel
    | typeof serviceLabel
    | typeof methodLabel
    | typeof pathLabel
    | typeof codeLabel
  >;
};

export function prometheusClientMiddleware(
  options?: PrometheusClientMiddlewareOptions,
): ClientMiddleware {
  const clientStartedMetric =
    options?.clientStartedMetric || defaultClientStartedMetric;
  const clientHandledMetric =
    options?.clientHandledMetric || defaultClientHandledMetric;
  const clientStreamMsgReceivedMetric =
    options?.clientStreamMsgReceivedMetric ||
    defaultClientStreamMsgReceivedMetric;
  const clientStreamMsgSentMetric =
    options?.clientStreamMsgSentMetric || defaultClientStreamMsgSentMetric;
  const clientHandlingSecondsMetric =
    options?.clientHandlingSecondsMetric || defaultClientHandlingSecondsMetric;

  return async function* prometheusClientMiddlewareGenerator<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions,
  ): AsyncGenerator<Response, Response | void, undefined> {
    const labels = getLabels(call.method);

    clientStartedMetric.inc(labels);

    const stopTimer = clientHandlingSecondsMetric.startTimer(labels);

    let settled = false;
    let status: Status = Status.OK;

    try {
      let request;

      if (!call.requestStream) {
        request = call.request;
      } else {
        request = incrementStreamMessagesCounter(
          call.request,
          clientStreamMsgSentMetric.labels(labels),
        );
      }

      if (!call.responseStream) {
        const response = yield* call.next(request, options);

        settled = true;

        return response;
      } else {
        yield* incrementStreamMessagesCounter(
          call.next(request, options),
          clientStreamMsgReceivedMetric.labels(labels),
        );

        settled = true;

        return;
      }
    } catch (err: unknown) {
      settled = true;

      if (err instanceof ClientError) {
        status = err.code;
      } else if (isAbortError(err)) {
        status = Status.CANCELLED;
      } else {
        status = Status.UNKNOWN;
      }

      throw err;
    } finally {
      if (!settled) {
        status = Status.CANCELLED;
      }

      stopTimer({[codeLabel]: Status[status]});
      clientHandledMetric.inc({
        ...labels,
        [codeLabel]: Status[status],
      });
    }
  };
}
