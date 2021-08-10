# nice-grpc-server-middleware-terminator [![npm version][npm-image]][npm-url]

Server middleware for [nice-grpc](https://github.com/deeplay-io/nice-grpc) that
makes it possible to prevent long-running calls from blocking server graceful
shutdown.

When `server.shutdown()` is called, the server stops accepting new calls, but
the returned promise only resolves once all inflight requests finish. If you
have a long-running call like an infinite stream, the shutdown will block
forever. With this middleware, service implementation methods can alter this
behavior, so that on shutdown the call would be aborted and clients would
receive status code `UNAVAILABLE`.

## Installation

    npm install nice-grpc-server-middleware-terminator

## Usage

Consider the following service definition with a streaming method:

```protobuf
service ExampleService {
  rpc ExampleMethod(ExampleRequest)
    returns (stream ExampleResponse) {};
}
```

In this example implementation we emit a response every second until aborted:

```ts
import {ServiceImplementation, CallContext} from 'nice-grpc';
import {TerminatorContext} from 'nice-grpc-server-middleware-terminator';
import {delay} from 'abort-controller-x';
import {
  ExampleServiceDefinition,
  ExampleRequest,
  ExampleResponse,
  DeepPartial,
} from './compiled_proto/example';

const exampleServiceImpl: ServiceImplementation<
  typeof ExampleServiceDefinition,
  TerminatorContext
> = {
  async *exampleMethod(
    request: ExampleRequest,
    context: CallContext & TerminatorContext,
  ): AsyncIterable<DeepPartial<ExampleResponse>> {
    // When `terminatorMiddleware.terminate()` is called, `context.signal` will
    // be aborted and the client would receive gRPC error
    // `UNAVAILABLE: Server shutting down`.
    //
    // Note that the method is still responsible for aborting all the work once
    // `context.signal` is aborted.
    context.abortOnTerminate();

    while (true) {
      await delay(context.signal, 1000);

      yield {
        /* ... */
      };
    }
  },
};
```

Attach the middleware to the server and terminate it before shutdown:

```ts
import {createServer} from 'nice-grpc';
import {TerminatorMiddleware} from 'nice-grpc-server-middleware-terminator';
import {ExampleServiceDefinition} from './compiled_proto/example';

const terminatorMiddleware = TerminatorMiddleware();

const server = createServer().use(terminatorMiddleware);
server.add(ExampleServiceDefinition, exampleServiceImpl);
await server.listen('0.0.0.0:8080');

// ... terminate middleware before shutdown:

terminatorMiddleware.terminate();
await server.shutdown();
```

[npm-image]: https://badge.fury.io/js/nice-grpc-server-middleware-terminator.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-server-middleware-terminator
