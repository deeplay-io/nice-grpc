# nice-grpc-server-health [![npm version][npm-image]][npm-url]

[Health Checking Protocol](https://github.com/grpc/grpc/blob/master/doc/health-checking.md)
implementation for [nice-grpc](https://github.com/deeplay-io/nice-grpc).

This package enables you to use tools like
[grpc-health-probe](https://github.com/grpc-ecosystem/grpc-health-probe) with
your gRPC server.

In Kubernetes,
[gRPC probes](https://kubernetes.io/blog/2022/05/13/grpc-probes-now-in-beta/)
are supported natively.

## Installation

    npm install nice-grpc-server-health

## Usage

### Basic

For the simplest usage, just add the
[`Health`](https://github.com/grpc/grpc-proto/blob/master/grpc/health/v1/health.proto)
service implementation to your server. The server will be considered healthy
while it is able to accept requests.

```ts
import {createServer} from 'nice-grpc';
import {HealthDefinition, HealthServiceImpl} from 'nice-grpc-server-health';

const server = createServer();

server.add(HealthDefinition, HealthServiceImpl());
```

### Advanced

You can control the health state of the server or per-service with `HealthState`
object:

```ts
import {createServer} from 'nice-grpc';
import {
  HealthDefinition,
  HealthServiceImpl,
  HealthState,
} from 'nice-grpc-server-health';

const server = createServer();

const healthState = HealthState();

server.add(HealthDefinition, HealthServiceImpl(healthState));
// Add our own service
server.add(MyService, myServiceImpl);

// Set the server status to `unhealthy`. The default server status is `healthy`.
healthState.setStatus('unhealthy');
// Set the `MyService` status to `unhealthy` by specifying fully-qualified name.
// The default service status is `unknown`.
healthState.setStatus('unhealthy', MyService.fullName);

// ...

healthState.setStatus('healthy');
healthState.setStatus('healthy', MyService.fullName);
```

This package also supports the `Watch` method that is able to send real-time
updates of health statuses. Since the `Watch` method returns infinite stream, it
is recommended to use the
[terminator middleware](https://github.com/deeplay-io/nice-grpc/tree/master/packages/nice-grpc-server-middleware-terminator):

```ts
import {createServer} from 'nice-grpc';
import {HealthDefinition, HealthServiceImpl} from 'nice-grpc-server-health';
import {TerminatorMiddleware} from 'nice-grpc-server-middleware-terminator';

const terminatorMiddleware = TerminatorMiddleware();

const server = createServer().use(terminatorMiddleware);
server.add(HealthDefinition, HealthServiceImpl());
await server.listen('0.0.0.0:8080');

// ... terminate middleware before shutdown:

terminatorMiddleware.terminate();
await server.shutdown();
```

[npm-image]: https://badge.fury.io/js/nice-grpc-server-health.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-server-health
