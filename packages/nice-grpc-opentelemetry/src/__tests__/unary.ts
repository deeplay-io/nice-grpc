import {createChannel, createClientFactory, createServer} from 'nice-grpc';
import {openTelemetryClientMiddleware, openTelemetryServerMiddleware} from '..';
import {TestDefinition} from '../../fixtures/test';
import {throwUnimplemented} from './utils/throwUnimplemented';
import {NodeSDK} from '@opentelemetry/sdk-node';
import {tracing, metrics} from '@opentelemetry/sdk-node';
import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);

test('basic', async () => {
  const traceExporter = new tracing.InMemorySpanExporter();
  const metricExporter = new metrics.InMemoryMetricExporter(
    metrics.AggregationTemporality.DELTA,
  );
  const metricReader = new metrics.PeriodicExportingMetricReader({
    exporter: metricExporter,
  });

  const sdk = new NodeSDK({
    spanLimits: {},
    // traceExporter,
    spanProcessor: new tracing.SimpleSpanProcessor(traceExporter),
    metricReader,
  });
  await sdk.start();

  const server = createServer().use(openTelemetryServerMiddleware());

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
    .use(openTelemetryClientMiddleware())
    .create(TestDefinition, channel);

  await client.testUnary({});

  const [serverSpan, clientSpan] = traceExporter.getFinishedSpans();

  function dumpSpan(span: tracing.ReadableSpan) {
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

  expect(dumpSpan(clientSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "rpc.grpc.status_code": 0,
        "rpc.grpc.status_text": "OK",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "SENT",
          },
          "name": "message",
        },
      ],
      "kind": "CLIENT",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "UNSET",
        "message": undefined,
      },
    }
  `);

  delete serverSpan.attributes['net.peer.port'];
  expect(dumpSpan(serverSpan)).toMatchInlineSnapshot(`
    Object {
      "attributes": Object {
        "net.peer.ip": "::1",
        "rpc.grpc.status_code": 0,
        "rpc.grpc.status_text": "OK",
        "rpc.method": "TestUnary",
        "rpc.service": "nice_grpc.test.Test",
        "rpc.system": "grpc",
      },
      "events": Array [
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "RECEIVED",
          },
          "name": "message",
        },
        Object {
          "attributes": Object {
            "message.id": 1,
            "message.type": "SENT",
          },
          "name": "message",
        },
      ],
      "kind": "SERVER",
      "name": "nice_grpc.test.Test/TestUnary",
      "status": Object {
        "code": "UNSET",
        "message": undefined,
      },
    }
  `);

  const {resourceMetrics} = await metricReader.collect();
  expect(resourceMetrics.scopeMetrics).toMatchInlineSnapshot(`
    Array [
      Object {
        "metrics": Array [
          Object {
            "aggregationTemporality": 0,
            "dataPointType": 0,
            "dataPoints": Array [
              Object {
                "attributes": Object {
                  "net.peer.ip": "::1",
                  "net.peer.port": 56116,
                  "rpc.grpc.status_code": 0,
                  "rpc.grpc.status_text": "OK",
                  "rpc.method": "TestUnary",
                  "rpc.service": "nice_grpc.test.Test",
                  "rpc.system": "grpc",
                },
                "endTime": Array [
                  1659951927,
                  935316466,
                ],
                "startTime": Array [
                  1659951927,
                  925396016,
                ],
                "value": Object {
                  "buckets": Object {
                    "boundaries": Array [
                      0,
                      5,
                      10,
                      25,
                      50,
                      75,
                      100,
                      250,
                      500,
                      1000,
                    ],
                    "counts": Array [
                      0,
                      1,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                    ],
                  },
                  "count": 1,
                  "max": 0.3892199993133545,
                  "min": 0.3892199993133545,
                  "sum": 0.3892199993133545,
                },
              },
            ],
            "descriptor": Object {
              "description": "measures duration of inbound RPC",
              "name": "rpc.server.duration",
              "type": "HISTOGRAM",
              "unit": "milliseconds",
              "valueType": 1,
            },
          },
          Object {
            "aggregationTemporality": 0,
            "dataPointType": 0,
            "dataPoints": Array [
              Object {
                "attributes": Object {
                  "net.peer.ip": "::1",
                  "net.peer.port": 56116,
                  "rpc.method": "TestUnary",
                  "rpc.service": "nice_grpc.test.Test",
                  "rpc.system": "grpc",
                },
                "endTime": Array [
                  1659951927,
                  935316466,
                ],
                "startTime": Array [
                  1659951927,
                  925058611,
                ],
                "value": Object {
                  "buckets": Object {
                    "boundaries": Array [
                      0,
                      5,
                      10,
                      25,
                      50,
                      75,
                      100,
                      250,
                      500,
                      1000,
                    ],
                    "counts": Array [
                      0,
                      1,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                    ],
                  },
                  "count": 1,
                  "max": 1,
                  "min": 1,
                  "sum": 1,
                },
              },
            ],
            "descriptor": Object {
              "description": "measures the number of messages received by server per RPC. Should be 1 for all non-streaming RPCs",
              "name": "rpc.server.requests_per_rpc",
              "type": "HISTOGRAM",
              "unit": "count",
              "valueType": 0,
            },
          },
          Object {
            "aggregationTemporality": 0,
            "dataPointType": 0,
            "dataPoints": Array [
              Object {
                "attributes": Object {
                  "net.peer.ip": "::1",
                  "net.peer.port": 56116,
                  "rpc.method": "TestUnary",
                  "rpc.service": "nice_grpc.test.Test",
                  "rpc.system": "grpc",
                },
                "endTime": Array [
                  1659951927,
                  935316466,
                ],
                "startTime": Array [
                  1659951927,
                  925274121,
                ],
                "value": Object {
                  "buckets": Object {
                    "boundaries": Array [
                      0,
                      5,
                      10,
                      25,
                      50,
                      75,
                      100,
                      250,
                      500,
                      1000,
                    ],
                    "counts": Array [
                      0,
                      1,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                    ],
                  },
                  "count": 1,
                  "max": 1,
                  "min": 1,
                  "sum": 1,
                },
              },
            ],
            "descriptor": Object {
              "description": "measures the number of messages sent by server per RPC. Should be 1 for all non-streaming RPCs",
              "name": "rpc.server.responses_per_rpc",
              "type": "HISTOGRAM",
              "unit": "count",
              "valueType": 0,
            },
          },
          Object {
            "aggregationTemporality": 0,
            "dataPointType": 3,
            "dataPoints": Array [
              Object {
                "attributes": Object {
                  "net.peer.ip": "::1",
                  "net.peer.port": 56116,
                  "rpc.method": "TestUnary",
                  "rpc.service": "nice_grpc.test.Test",
                  "rpc.system": "grpc",
                },
                "endTime": Array [
                  1659951927,
                  935316466,
                ],
                "startTime": Array [
                  1659951927,
                  924973082,
                ],
                "value": 0,
              },
            ],
            "descriptor": Object {
              "description": "measures the number of concurrent RPCs that are currently in-flight",
              "name": "rpc.server.active_rpcs",
              "type": "UP_DOWN_COUNTER",
              "unit": "rpcs",
              "valueType": 0,
            },
            "isMonotonic": false,
          },
          Object {
            "aggregationTemporality": 0,
            "dataPointType": 0,
            "dataPoints": Array [
              Object {
                "attributes": Object {
                  "rpc.grpc.status_code": 0,
                  "rpc.grpc.status_text": "OK",
                  "rpc.method": "TestUnary",
                  "rpc.service": "nice_grpc.test.Test",
                  "rpc.system": "grpc",
                },
                "endTime": Array [
                  1659951927,
                  935316466,
                ],
                "startTime": Array [
                  1659951927,
                  931452071,
                ],
                "value": Object {
                  "buckets": Object {
                    "boundaries": Array [
                      0,
                      5,
                      10,
                      25,
                      50,
                      75,
                      100,
                      250,
                      500,
                      1000,
                    ],
                    "counts": Array [
                      0,
                      0,
                      0,
                      0,
                      1,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                    ],
                  },
                  "count": 1,
                  "max": 29.664366960525513,
                  "min": 29.664366960525513,
                  "sum": 29.664366960525513,
                },
              },
            ],
            "descriptor": Object {
              "description": "measures duration of outbound RPC",
              "name": "rpc.client.duration",
              "type": "HISTOGRAM",
              "unit": "milliseconds",
              "valueType": 1,
            },
          },
          Object {
            "aggregationTemporality": 0,
            "dataPointType": 0,
            "dataPoints": Array [
              Object {
                "attributes": Object {
                  "rpc.method": "TestUnary",
                  "rpc.service": "nice_grpc.test.Test",
                  "rpc.system": "grpc",
                },
                "endTime": Array [
                  1659951927,
                  935316466,
                ],
                "startTime": Array [
                  1659951927,
                  902257037,
                ],
                "value": Object {
                  "buckets": Object {
                    "boundaries": Array [
                      0,
                      5,
                      10,
                      25,
                      50,
                      75,
                      100,
                      250,
                      500,
                      1000,
                    ],
                    "counts": Array [
                      0,
                      1,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                    ],
                  },
                  "count": 1,
                  "max": 1,
                  "min": 1,
                  "sum": 1,
                },
              },
            ],
            "descriptor": Object {
              "description": "measures the number of messages sent by client per RPC. Should be 1 for all non-streaming RPCs",
              "name": "rpc.client.requests_per_rpc",
              "type": "HISTOGRAM",
              "unit": "count",
              "valueType": 0,
            },
          },
          Object {
            "aggregationTemporality": 0,
            "dataPointType": 0,
            "dataPoints": Array [
              Object {
                "attributes": Object {
                  "rpc.method": "TestUnary",
                  "rpc.service": "nice_grpc.test.Test",
                  "rpc.system": "grpc",
                },
                "endTime": Array [
                  1659951927,
                  935316466,
                ],
                "startTime": Array [
                  1659951927,
                  931297696,
                ],
                "value": Object {
                  "buckets": Object {
                    "boundaries": Array [
                      0,
                      5,
                      10,
                      25,
                      50,
                      75,
                      100,
                      250,
                      500,
                      1000,
                    ],
                    "counts": Array [
                      0,
                      1,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                      0,
                    ],
                  },
                  "count": 1,
                  "max": 1,
                  "min": 1,
                  "sum": 1,
                },
              },
            ],
            "descriptor": Object {
              "description": "measures the number of messages received by client per RPC. Should be 1 for all non-streaming RPCs",
              "name": "rpc.client.responses_per_rpc",
              "type": "HISTOGRAM",
              "unit": "count",
              "valueType": 0,
            },
          },
          Object {
            "aggregationTemporality": 0,
            "dataPointType": 3,
            "dataPoints": Array [
              Object {
                "attributes": Object {
                  "rpc.method": "TestUnary",
                  "rpc.service": "nice_grpc.test.Test",
                  "rpc.system": "grpc",
                },
                "endTime": Array [
                  1659951927,
                  935316466,
                ],
                "startTime": Array [
                  1659951927,
                  901841812,
                ],
                "value": 0,
              },
            ],
            "descriptor": Object {
              "description": "measures the number of concurrent RPCs that are currently in-flight",
              "name": "rpc.client.active_rpcs",
              "type": "UP_DOWN_COUNTER",
              "unit": "rpcs",
              "valueType": 0,
            },
            "isMonotonic": false,
          },
        ],
        "scope": Object {
          "name": "nice-grpc-opentelemetry",
          "schemaUrl": undefined,
          "version": "0.0.0",
        },
      },
    ]
  `);

  channel.close();

  await server.shutdown();
});
