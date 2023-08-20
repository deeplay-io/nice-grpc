import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {Counter, Histogram, Registry} from 'prom-client';
import {
  prometheusClientMiddleware,
  prometheusServerMiddleware,
  labelNames,
} from '..';
import {TestDefinition} from '../../fixtures/test';
import {dumpMetrics} from './utils/dumpMetrics';
import {throwUnimplemented} from './utils/throwUnimplemented';

const registry = new Registry();

const serverStartedMetric = new Counter({
  registers: [registry],
  name: 'custom_grpc_server_started_total',
  help: 'Custom total number of RPCs started on the server.',
  labelNames,
});

const serverHandledMetric = new Counter({
  registers: [registry],
  name: 'custom_grpc_server_handled_total',
  help: 'Custom total number of RPCs completed on the server, regardless of success or failure.',
  labelNames,
});

const serverStreamMsgReceivedMetric = new Counter({
  registers: [registry],
  name: 'custom_grpc_server_msg_received_total',
  help: 'Custom total number of RPC stream messages received by the server.',
  labelNames,
});

const serverStreamMsgSentMetric = new Counter({
  registers: [registry],
  name: 'custom_grpc_server_msg_sent_total',
  help: 'Custom total number of gRPC stream messages sent by the server.',
  labelNames,
});

const serverHandlingSecondsMetric = new Histogram({
  registers: [registry],
  name: 'custom_grpc_server_handling_seconds',
  help: 'Custom histogram of response latency (seconds) of gRPC that had been application-level handled by the server.',
  labelNames,
  buckets: [0.1, 0.5, 1],
});

const clientStartedMetric = new Counter({
  registers: [registry],
  name: 'custom_grpc_client_started_total',
  help: 'Custom total number of RPCs started on the client.',
  labelNames,
});

const clientHandledMetric = new Counter({
  registers: [registry],
  name: 'custom_grpc_client_handled_total',
  help: 'Custom total number of RPCs completed on the client, regardless of success or failure.',
  labelNames,
});

const clientStreamMsgReceivedMetric = new Counter({
  registers: [registry],
  name: 'custom_grpc_client_msg_received_total',
  help: 'Custom total number of RPC stream messages received by the client.',
  labelNames,
});

const clientStreamMsgSentMetric = new Counter({
  registers: [registry],
  name: 'custom_grpc_client_msg_sent_total',
  help: 'Custom total number of gRPC stream messages sent by the client.',
  labelNames,
});

const clientHandlingSecondsMetric = new Histogram({
  registers: [registry],
  name: 'custom_grpc_client_handling_seconds',
  help: 'Custom histogram of response latency (seconds) of the gRPC until it is finished by the application.',
  labelNames,
  buckets: [0.1, 0.5, 1],
});

beforeEach(() => {
  registry.resetMetrics();
});

test('basic', async () => {
  const server = createServer().use(
    prometheusServerMiddleware({
      serverStartedMetric,
      serverHandledMetric,
      serverStreamMsgReceivedMetric,
      serverStreamMsgSentMetric,
      serverHandlingSecondsMetric,
    }),
  );

  server.add(TestDefinition, {
    async testUnary() {
      return {};
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(
      prometheusClientMiddleware({
        clientStartedMetric,
        clientHandledMetric,
        clientStreamMsgReceivedMetric,
        clientStreamMsgSentMetric,
        clientHandlingSecondsMetric,
      }),
    )
    .create(TestDefinition, channel);

  await client.testUnary({});

  expect(await dumpMetrics(registry)).toMatchInlineSnapshot(`
    "# HELP custom_grpc_server_started_total Custom total number of RPCs started on the server.
    # TYPE custom_grpc_server_started_total counter
    custom_grpc_server_started_total{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary"} 1

    # HELP custom_grpc_server_handled_total Custom total number of RPCs completed on the server, regardless of success or failure.
    # TYPE custom_grpc_server_handled_total counter
    custom_grpc_server_handled_total{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} 1

    # HELP custom_grpc_server_msg_received_total Custom total number of RPC stream messages received by the server.
    # TYPE custom_grpc_server_msg_received_total counter

    # HELP custom_grpc_server_msg_sent_total Custom total number of gRPC stream messages sent by the server.
    # TYPE custom_grpc_server_msg_sent_total counter

    # HELP custom_grpc_server_handling_seconds Custom histogram of response latency (seconds) of gRPC that had been application-level handled by the server.
    # TYPE custom_grpc_server_handling_seconds histogram
    custom_grpc_server_handling_seconds_bucket{le="0.1",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_server_handling_seconds_bucket{le="0.5",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_server_handling_seconds_bucket{le="1",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_server_handling_seconds_bucket{le="+Inf",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_server_handling_seconds_sum{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_server_handling_seconds_count{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} 1

    # HELP custom_grpc_client_started_total Custom total number of RPCs started on the client.
    # TYPE custom_grpc_client_started_total counter
    custom_grpc_client_started_total{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary"} 1

    # HELP custom_grpc_client_handled_total Custom total number of RPCs completed on the client, regardless of success or failure.
    # TYPE custom_grpc_client_handled_total counter
    custom_grpc_client_handled_total{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} 1

    # HELP custom_grpc_client_msg_received_total Custom total number of RPC stream messages received by the client.
    # TYPE custom_grpc_client_msg_received_total counter

    # HELP custom_grpc_client_msg_sent_total Custom total number of gRPC stream messages sent by the client.
    # TYPE custom_grpc_client_msg_sent_total counter

    # HELP custom_grpc_client_handling_seconds Custom histogram of response latency (seconds) of the gRPC until it is finished by the application.
    # TYPE custom_grpc_client_handling_seconds histogram
    custom_grpc_client_handling_seconds_bucket{le="0.1",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_client_handling_seconds_bucket{le="0.5",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_client_handling_seconds_bucket{le="1",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_client_handling_seconds_bucket{le="+Inf",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_client_handling_seconds_sum{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} <num>
    custom_grpc_client_handling_seconds_count{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="OK"} 1
    "
  `);

  channel.close();

  await server.shutdown();
});

test('error', async () => {
  const server = createServer().use(
    prometheusServerMiddleware({
      serverStartedMetric,
      serverHandledMetric,
      serverStreamMsgReceivedMetric,
      serverStreamMsgSentMetric,
      serverHandlingSecondsMetric,
    }),
  );

  server.add(TestDefinition, {
    async testUnary() {
      throw new ServerError(Status.NOT_FOUND, 'test error message');
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(
      prometheusClientMiddleware({
        clientStartedMetric,
        clientHandledMetric,
        clientStreamMsgReceivedMetric,
        clientStreamMsgSentMetric,
        clientHandlingSecondsMetric,
      }),
    )
    .create(TestDefinition, channel);

  await client.testUnary({}).catch(() => {});

  expect(await dumpMetrics(registry)).toMatchInlineSnapshot(`
    "# HELP custom_grpc_server_started_total Custom total number of RPCs started on the server.
    # TYPE custom_grpc_server_started_total counter
    custom_grpc_server_started_total{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary"} 1

    # HELP custom_grpc_server_handled_total Custom total number of RPCs completed on the server, regardless of success or failure.
    # TYPE custom_grpc_server_handled_total counter
    custom_grpc_server_handled_total{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} 1

    # HELP custom_grpc_server_msg_received_total Custom total number of RPC stream messages received by the server.
    # TYPE custom_grpc_server_msg_received_total counter

    # HELP custom_grpc_server_msg_sent_total Custom total number of gRPC stream messages sent by the server.
    # TYPE custom_grpc_server_msg_sent_total counter

    # HELP custom_grpc_server_handling_seconds Custom histogram of response latency (seconds) of gRPC that had been application-level handled by the server.
    # TYPE custom_grpc_server_handling_seconds histogram
    custom_grpc_server_handling_seconds_bucket{le="0.1",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_server_handling_seconds_bucket{le="0.5",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_server_handling_seconds_bucket{le="1",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_server_handling_seconds_bucket{le="+Inf",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_server_handling_seconds_sum{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_server_handling_seconds_count{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} 1

    # HELP custom_grpc_client_started_total Custom total number of RPCs started on the client.
    # TYPE custom_grpc_client_started_total counter
    custom_grpc_client_started_total{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary"} 1

    # HELP custom_grpc_client_handled_total Custom total number of RPCs completed on the client, regardless of success or failure.
    # TYPE custom_grpc_client_handled_total counter
    custom_grpc_client_handled_total{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} 1

    # HELP custom_grpc_client_msg_received_total Custom total number of RPC stream messages received by the client.
    # TYPE custom_grpc_client_msg_received_total counter

    # HELP custom_grpc_client_msg_sent_total Custom total number of gRPC stream messages sent by the client.
    # TYPE custom_grpc_client_msg_sent_total counter

    # HELP custom_grpc_client_handling_seconds Custom histogram of response latency (seconds) of the gRPC until it is finished by the application.
    # TYPE custom_grpc_client_handling_seconds histogram
    custom_grpc_client_handling_seconds_bucket{le="0.1",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_client_handling_seconds_bucket{le="0.5",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_client_handling_seconds_bucket{le="1",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_client_handling_seconds_bucket{le="+Inf",grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_client_handling_seconds_sum{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} <num>
    custom_grpc_client_handling_seconds_count{grpc_type="unary",grpc_service="nice_grpc.test.Test",grpc_method="TestUnary",grpc_path="/nice_grpc.test.Test/TestUnary",grpc_code="NOT_FOUND"} 1
    "
  `);

  channel.close();

  await server.shutdown();
});
