import {isAbortError} from 'abort-controller-x';
import {
  CallContext,
  ServerError,
  ServerMiddleware,
  ServerMiddlewareCall,
  Status,
} from 'nice-grpc-common';
import {Counter, Histogram} from 'prom-client';
import {
  codeLabel,
  getLabels,
  incrementStreamMessagesCounter,
  latencySecondsBuckets,
  methodLabel,
  pathLabel,
  serviceLabel,
  typeLabel,
} from './common';
import {registry} from './registry';

const serverStartedMetric = new Counter({
  registers: [registry],
  name: 'grpc_server_started_total',
  help: 'Total number of RPCs started on the server.',
  labelNames: [typeLabel, serviceLabel, methodLabel, pathLabel],
});

const serverHandledMetric = new Counter({
  registers: [registry],
  name: 'grpc_server_handled_total',
  help: 'Total number of RPCs completed on the server, regardless of success or failure.',
  labelNames: [typeLabel, serviceLabel, methodLabel, pathLabel, codeLabel],
});

const serverStreamMsgReceivedMetric = new Counter({
  registers: [registry],
  name: 'grpc_server_msg_received_total',
  help: 'Total number of RPC stream messages received by the server.',
  labelNames: [typeLabel, serviceLabel, methodLabel, pathLabel],
});

const serverStreamMsgSentMetric = new Counter({
  registers: [registry],
  name: 'grpc_server_msg_sent_total',
  help: 'Total number of gRPC stream messages sent by the server.',
  labelNames: [typeLabel, serviceLabel, methodLabel, pathLabel],
});

const serverHandlingSecondsMetric = new Histogram({
  registers: [registry],
  name: 'grpc_server_handling_seconds',
  help: 'Histogram of response latency (seconds) of gRPC that had been application-level handled by the server.',
  labelNames: [typeLabel, serviceLabel, methodLabel, pathLabel, codeLabel],
  buckets: latencySecondsBuckets,
});

export function prometheusServerMiddleware(): ServerMiddleware {
  return async function* prometheusServerMiddlewareGenerator<Request, Response>(
    call: ServerMiddlewareCall<Request, Response>,
    context: CallContext,
  ): AsyncGenerator<Response, Response | void, undefined> {
    const labels = getLabels(call.method);

    serverStartedMetric.inc(labels);

    const stopTimer = serverHandlingSecondsMetric.startTimer(labels);

    let settled = false;
    let status: Status = Status.OK;

    try {
      let request;

      if (!call.requestStream) {
        request = call.request;
      } else {
        request = incrementStreamMessagesCounter(
          call.request,
          serverStreamMsgReceivedMetric.labels(labels),
        );
      }

      if (!call.responseStream) {
        const response = yield* call.next(request, context);

        settled = true;

        return response;
      } else {
        yield* incrementStreamMessagesCounter(
          call.next(request, context),
          serverStreamMsgSentMetric.labels(labels),
        );

        settled = true;

        return;
      }
    } catch (err: unknown) {
      settled = true;

      if (err instanceof ServerError) {
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
      serverHandledMetric.inc({
        ...labels,
        [codeLabel]: Status[status],
      });
    }
  };
}
