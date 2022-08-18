# nice-grpc-opentelemetry [![npm version][npm-image]][npm-url]

[OpenTelemetry](https://opentelemetry.io/) instrumentation for
[nice-grpc](https://github.com/deeplay-io/nice-grpc). Currently provides only
[traces](#traces).

## Installation

    npm install nice-grpc-opentelemetry

## Usage

Attach middleware as the first one on the server:

```ts
import {createServer} from 'nice-grpc';
import {openTelemetryServerMiddleware} from 'nice-grpc-opentelemetry';

const server = createServer()
  .use(openTelemetryServerMiddleware())
  .use(/* ... other middleware */);
```

Attach middleware as the first one on the client:

```ts
import {createClientFactory} from 'nice-grpc'; // or 'nice-grpc-web'
import {openTelemetryClientMiddleware} from 'nice-grpc-opentelemetry';

const clientFactory = createClientFactory()
  .use(openTelemetryClientMiddleware())
  .use(/* ... other middleware */);

const client = clientFactory.create(/* ... */);
```

## Traces

This library generates spans according to
[Semantic conventions for RPC spans](https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/)
with an addition of custom attributes:

| Attribute              | Type   | Description                                | Examples           |
| ---------------------- | ------ | ------------------------------------------ | ------------------ |
| `rpc.grpc.status_text` | string | The name of the status of the gRPC request | `INVALID_ARGUMENT` |

[npm-image]: https://badge.fury.io/js/nice-grpc-opentelemetry.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-opentelemetry
