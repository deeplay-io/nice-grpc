import {forever} from 'abort-controller-x';
import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {
  prometheusClientMiddleware,
  prometheusServerMiddleware,
  registry,
} from '..';
import {TestDefinition} from '../../fixtures/test';
import {dumpMetrics} from './utils/dumpMetrics';
import {throwUnimplemented} from './utils/throwUnimplemented';
import defer = require('defer-promise');

beforeEach(() => {
  registry.resetMetrics();
});

test('basic', async () => {
  const server = createServer().use(prometheusServerMiddleware());

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
    .use(prometheusClientMiddleware())
    .create(TestDefinition, channel);

  await client.testUnary({});

  expect(await dumpMetrics(registry)).toMatchInlineSnapshot(`
    "# HELP grpc_server_started_total Total number of RPCs started on the server.
    # TYPE grpc_server_started_total counter
    grpc_server_started_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\"} 1

    # HELP grpc_server_handled_total Total number of RPCs completed on the server, regardless of success or failure.
    # TYPE grpc_server_handled_total counter
    grpc_server_handled_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} 1

    # HELP grpc_server_msg_received_total Total number of RPC stream messages received by the server.
    # TYPE grpc_server_msg_received_total counter

    # HELP grpc_server_msg_sent_total Total number of gRPC stream messages sent by the server.
    # TYPE grpc_server_msg_sent_total counter

    # HELP grpc_server_handling_seconds Histogram of response latency (seconds) of gRPC that had been application-level handled by the server.
    # TYPE grpc_server_handling_seconds histogram
    grpc_server_handling_seconds_bucket{le=\\"0.001\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.004\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.016\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.064\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.256\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"1.024\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"4.096\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"16.384\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"65.536\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"262.144\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"1048.576\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"4194.304\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"+Inf\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_sum{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_server_handling_seconds_count{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} 1

    # HELP grpc_client_started_total Total number of RPCs started on the client.
    # TYPE grpc_client_started_total counter
    grpc_client_started_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\"} 1

    # HELP grpc_client_handled_total Total number of RPCs completed on the client, regardless of success or failure.
    # TYPE grpc_client_handled_total counter
    grpc_client_handled_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} 1

    # HELP grpc_client_msg_received_total Total number of RPC stream messages received by the client.
    # TYPE grpc_client_msg_received_total counter

    # HELP grpc_client_msg_sent_total Total number of gRPC stream messages sent by the client.
    # TYPE grpc_client_msg_sent_total counter

    # HELP grpc_client_handling_seconds Histogram of response latency (seconds) of the gRPC until it is finished by the application.
    # TYPE grpc_client_handling_seconds histogram
    grpc_client_handling_seconds_bucket{le=\\"0.001\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.004\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.016\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.064\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.256\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"1.024\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"4.096\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"16.384\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"65.536\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"262.144\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"1048.576\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"4194.304\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"+Inf\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_sum{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} <num>
    grpc_client_handling_seconds_count{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"OK\\"} 1
    "
  `);

  channel.close();

  await server.shutdown();
});

test('error', async () => {
  const server = createServer().use(prometheusServerMiddleware());

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
    .use(prometheusClientMiddleware())
    .create(TestDefinition, channel);

  await client.testUnary({}).catch(() => {});

  expect(await dumpMetrics(registry)).toMatchInlineSnapshot(`
    "# HELP grpc_server_started_total Total number of RPCs started on the server.
    # TYPE grpc_server_started_total counter
    grpc_server_started_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\"} 1

    # HELP grpc_server_handled_total Total number of RPCs completed on the server, regardless of success or failure.
    # TYPE grpc_server_handled_total counter
    grpc_server_handled_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} 1

    # HELP grpc_server_msg_received_total Total number of RPC stream messages received by the server.
    # TYPE grpc_server_msg_received_total counter

    # HELP grpc_server_msg_sent_total Total number of gRPC stream messages sent by the server.
    # TYPE grpc_server_msg_sent_total counter

    # HELP grpc_server_handling_seconds Histogram of response latency (seconds) of gRPC that had been application-level handled by the server.
    # TYPE grpc_server_handling_seconds histogram
    grpc_server_handling_seconds_bucket{le=\\"0.001\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.004\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.016\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.064\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.256\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"1.024\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"4.096\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"16.384\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"65.536\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"262.144\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"1048.576\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"4194.304\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"+Inf\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_sum{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_server_handling_seconds_count{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} 1

    # HELP grpc_client_started_total Total number of RPCs started on the client.
    # TYPE grpc_client_started_total counter
    grpc_client_started_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\"} 1

    # HELP grpc_client_handled_total Total number of RPCs completed on the client, regardless of success or failure.
    # TYPE grpc_client_handled_total counter
    grpc_client_handled_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} 1

    # HELP grpc_client_msg_received_total Total number of RPC stream messages received by the client.
    # TYPE grpc_client_msg_received_total counter

    # HELP grpc_client_msg_sent_total Total number of gRPC stream messages sent by the client.
    # TYPE grpc_client_msg_sent_total counter

    # HELP grpc_client_handling_seconds Histogram of response latency (seconds) of the gRPC until it is finished by the application.
    # TYPE grpc_client_handling_seconds histogram
    grpc_client_handling_seconds_bucket{le=\\"0.001\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.004\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.016\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.064\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.256\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"1.024\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"4.096\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"16.384\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"65.536\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"262.144\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"1048.576\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"4194.304\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"+Inf\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_sum{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} <num>
    grpc_client_handling_seconds_count{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"NOT_FOUND\\"} 1
    "
  `);

  channel.close();

  await server.shutdown();
});

test('unknown error', async () => {
  const server = createServer().use(prometheusServerMiddleware());

  server.add(TestDefinition, {
    async testUnary() {
      throw new Error('test error message');
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(prometheusClientMiddleware())
    .create(TestDefinition, channel);

  await client.testUnary({}).catch(() => {});

  expect(await dumpMetrics(registry)).toMatchInlineSnapshot(`
    "# HELP grpc_server_started_total Total number of RPCs started on the server.
    # TYPE grpc_server_started_total counter
    grpc_server_started_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\"} 1

    # HELP grpc_server_handled_total Total number of RPCs completed on the server, regardless of success or failure.
    # TYPE grpc_server_handled_total counter
    grpc_server_handled_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} 1

    # HELP grpc_server_msg_received_total Total number of RPC stream messages received by the server.
    # TYPE grpc_server_msg_received_total counter

    # HELP grpc_server_msg_sent_total Total number of gRPC stream messages sent by the server.
    # TYPE grpc_server_msg_sent_total counter

    # HELP grpc_server_handling_seconds Histogram of response latency (seconds) of gRPC that had been application-level handled by the server.
    # TYPE grpc_server_handling_seconds histogram
    grpc_server_handling_seconds_bucket{le=\\"0.001\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.004\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.016\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.064\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.256\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"1.024\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"4.096\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"16.384\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"65.536\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"262.144\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"1048.576\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"4194.304\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"+Inf\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_sum{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_server_handling_seconds_count{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} 1

    # HELP grpc_client_started_total Total number of RPCs started on the client.
    # TYPE grpc_client_started_total counter
    grpc_client_started_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\"} 1

    # HELP grpc_client_handled_total Total number of RPCs completed on the client, regardless of success or failure.
    # TYPE grpc_client_handled_total counter
    grpc_client_handled_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} 1

    # HELP grpc_client_msg_received_total Total number of RPC stream messages received by the client.
    # TYPE grpc_client_msg_received_total counter

    # HELP grpc_client_msg_sent_total Total number of gRPC stream messages sent by the client.
    # TYPE grpc_client_msg_sent_total counter

    # HELP grpc_client_handling_seconds Histogram of response latency (seconds) of the gRPC until it is finished by the application.
    # TYPE grpc_client_handling_seconds histogram
    grpc_client_handling_seconds_bucket{le=\\"0.001\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.004\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.016\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.064\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.256\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"1.024\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"4.096\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"16.384\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"65.536\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"262.144\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"1048.576\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"4194.304\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"+Inf\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_sum{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} <num>
    grpc_client_handling_seconds_count{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"UNKNOWN\\"} 1
    "
  `);

  channel.close();

  await server.shutdown();
});

test('cancel', async () => {
  const server = createServer().use(prometheusServerMiddleware());

  const serverRequestStartDeferred = defer<void>();

  server.add(TestDefinition, {
    async testUnary(request, {signal}) {
      serverRequestStartDeferred.resolve();

      return await forever(signal);
    },
    testServerStream: throwUnimplemented,
    testClientStream: throwUnimplemented,
    testBidiStream: throwUnimplemented,
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(prometheusClientMiddleware())
    .create(TestDefinition, channel);

  const abortController = new AbortController();

  client.testUnary({}, {signal: abortController.signal}).catch(() => {});

  await serverRequestStartDeferred.promise;

  abortController.abort();

  await new Promise(resolve => setTimeout(resolve, 100));

  expect(await dumpMetrics(registry)).toMatchInlineSnapshot(`
    "# HELP grpc_server_started_total Total number of RPCs started on the server.
    # TYPE grpc_server_started_total counter
    grpc_server_started_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\"} 1

    # HELP grpc_server_handled_total Total number of RPCs completed on the server, regardless of success or failure.
    # TYPE grpc_server_handled_total counter
    grpc_server_handled_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} 1

    # HELP grpc_server_msg_received_total Total number of RPC stream messages received by the server.
    # TYPE grpc_server_msg_received_total counter

    # HELP grpc_server_msg_sent_total Total number of gRPC stream messages sent by the server.
    # TYPE grpc_server_msg_sent_total counter

    # HELP grpc_server_handling_seconds Histogram of response latency (seconds) of gRPC that had been application-level handled by the server.
    # TYPE grpc_server_handling_seconds histogram
    grpc_server_handling_seconds_bucket{le=\\"0.001\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.004\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.016\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.064\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"0.256\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"1.024\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"4.096\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"16.384\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"65.536\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"262.144\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"1048.576\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"4194.304\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_bucket{le=\\"+Inf\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_sum{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_server_handling_seconds_count{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} 1

    # HELP grpc_client_started_total Total number of RPCs started on the client.
    # TYPE grpc_client_started_total counter
    grpc_client_started_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\"} 1

    # HELP grpc_client_handled_total Total number of RPCs completed on the client, regardless of success or failure.
    # TYPE grpc_client_handled_total counter
    grpc_client_handled_total{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} 1

    # HELP grpc_client_msg_received_total Total number of RPC stream messages received by the client.
    # TYPE grpc_client_msg_received_total counter

    # HELP grpc_client_msg_sent_total Total number of gRPC stream messages sent by the client.
    # TYPE grpc_client_msg_sent_total counter

    # HELP grpc_client_handling_seconds Histogram of response latency (seconds) of the gRPC until it is finished by the application.
    # TYPE grpc_client_handling_seconds histogram
    grpc_client_handling_seconds_bucket{le=\\"0.001\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.004\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.016\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.064\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"0.256\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"1.024\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"4.096\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"16.384\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"65.536\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"262.144\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"1048.576\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"4194.304\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_bucket{le=\\"+Inf\\",grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_sum{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} <num>
    grpc_client_handling_seconds_count{grpc_type=\\"unary\\",grpc_service=\\"nice_grpc.test.Test\\",grpc_method=\\"TestUnary\\",grpc_path=\\"/nice_grpc.test.Test/TestUnary\\",grpc_code=\\"CANCELLED\\"} 1
    "
  `);

  channel.close();

  await server.shutdown();
});
