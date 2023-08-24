# nice-grpc-prometheus [![npm version][npm-image]][npm-url]

[Prometheus](https://prometheus.io/) monitoring for
[nice-grpc](https://github.com/deeplay-io/nice-grpc). Uses
[prom-client](https://github.com/siimon/prom-client). Metrics mostly mimic
[go-grpc-prometheus](https://github.com/grpc-ecosystem/go-grpc-prometheus).

## Installation

    npm install nice-grpc-prometheus

## Usage

Import `nice-grpc-prometheus` metrics registry and
[merge it with the global registry](https://github.com/siimon/prom-client#multiple-registries):

```ts
import {register as globalRegistry, Registry} from 'prom-client';
import {registry as niceGrpcRegistry} from 'nice-grpc-prometheus';

// use `await mergedRegistry.metrics()` to export all metrics
const mergedRegistry = Registry.merge([globalRegistry, niceGrpcRegistry]);
```

Attach middleware as the first one on the server:

```ts
import {createServer} from 'nice-grpc';
import {prometheusServerMiddleware} from 'nice-grpc-prometheus';

const server = createServer()
  .use(prometheusServerMiddleware())
  .use(/* ... other middleware */);
```

Attach middleware as the first one on the client:

```ts
import {createClientFactory} from 'nice-grpc';
import {prometheusClientMiddleware} from 'nice-grpc-prometheus';

const clientFactory = createClientFactory()
  .use(prometheusClientMiddleware())
  .use(/* ... other middleware */);

const client = clientFactory.create(/* ... */);
```

## Metrics

Following metrics are provided:

### Server

| Name                             | Type      | Description                                                                                            | Labels               |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| `grpc_server_started_total`      | Counter   | Total number of RPCs started on the server.                                                            | Common (see below)   |
| `grpc_server_handled_total`      | Counter   | Total number of RPCs completed on the server, regardless of success or failure.                        | Common + `grpc_code` |
| `grpc_server_msg_received_total` | Counter   | Total number of RPC stream messages received by the server.                                            | Common               |
| `grpc_server_msg_sent_total`     | Counter   | Total number of gRPC stream messages sent by the server.                                               | Common               |
| `grpc_server_handling_seconds`   | Histogram | Histogram of response latency (seconds) of gRPC that had been application-level handled by the server. | Common + `grpc_code` |

### Client

| Name                             | Type      | Description                                                                                  | Labels               |
| -------------------------------- | --------- | -------------------------------------------------------------------------------------------- | -------------------- |
| `grpc_client_started_total`      | Counter   | Total number of RPCs started on the client.                                                  | Common               |
| `grpc_client_handled_total`      | Counter   | Total number of RPCs completed on the client, regardless of success or failure.              | Common + `grpc_code` |
| `grpc_client_msg_received_total` | Counter   | Total number of RPC stream messages received by the client.                                  | Common               |
| `grpc_client_msg_sent_total`     | Counter   | Total number of gRPC stream messages sent by the client.                                     | Common               |
| `grpc_client_handling_seconds`   | Histogram | Histogram of response latency (seconds) of the gRPC until it is finished by the application. | Common + `grpc_code` |

### Labels

Common labels:

| Name           | Description                    | Examples                                                 |
| -------------- | ------------------------------ | -------------------------------------------------------- |
| `grpc_type`    | Call type                      | `unary`, `server_stream`, `client_stream`, `bidi_stream` |
| `grpc_path`    | Full path of a method          | `/my.package.MyService/MyMethod`                         |
| `grpc_service` | Full service name with package | `my.package.MyService`                                   |
| `grpc_method`  | Method name                    | `MyMethod`                                               |

Metrics that correspond to finished calls have extra label:

| Name        | Description                                                                  | Examples                       |
| ----------- | ---------------------------------------------------------------------------- | ------------------------------ |
| `grpc_code` | [Status code](https://grpc.github.io/grpc/core/md_doc_statuscodes.html) name | `OK`, `CANCELLED`, `NOT_FOUND` |

[npm-image]: https://badge.fury.io/js/nice-grpc-prometheus.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-prometheus

### Customization

You can use your own metric instances. This can be useful for example if you
want to use your own buckets in histograms.

```ts
import {createClientFactory} from 'nice-grpc';
import {
  labelNamesWithCode,
  prometheusClientMiddleware,
} from 'nice-grpc-prometheus';
import {Histogram, Registry} from 'prom-client';

const registry = new Registry();

const clientHandlingSecondsMetric = new Histogram({
  registers: [registry],
  name: 'custom_grpc_client_handling_seconds',
  help: 'Custom histogram of response latency (seconds) of the gRPC until it is finished by the application.',
  labelNames: labelNamesWithCode,
  buckets: [0.1, 0.5, 1, 2, 3, 5, 10],
});

const clientFactory = createClientFactory()
  .use(prometheusClientMiddleware({clientHandlingSecondsMetric}))
  .use(/* ... other middleware */);
```

Don't forget
[to merge new registry with the global registry](https://github.com/siimon/prom-client#multiple-registries)
or use default registry instead.

Client middleware options:

```ts
{
  clientStartedMetric?: Counter; // labelNames: labelNames
  clientHandledMetric?: Counter; // labelNames: labelNamesWithCode
  clientStreamMsgReceivedMetric?: Counter; // labelNames: labelNames
  clientStreamMsgSentMetric?: Counter; // labelNames: labelNames
  clientHandlingSecondsMetric?: Histogram; // labelNames: labelNamesWithCode
}
```

Server middleware options:

```ts
{
  serverStartedMetric?: Counter; // labelNames: labelNames
  serverHandledMetric?: Counter; // labelNames: labelNamesWithCode
  serverStreamMsgReceivedMetric?: Counter; // labelNames: labelNames
  serverStreamMsgSentMetric?: Counter; // labelNames: labelNames
  serverHandlingSecondsMetric?: Histogram; // labelNames: labelNamesWithCode
}
```

**Caution:** Use the labelNames specified in the comment. Using incorrect
labelNames may cause errors now or in the future.
