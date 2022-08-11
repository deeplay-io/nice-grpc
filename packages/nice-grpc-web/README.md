# nice-grpc-web [![npm version][npm-image]][npm-url] <!-- omit in toc -->

A Browser gRPC client library that is nice to you. Built on top of
[`@improbable-eng/grpc-web`](https://www.npmjs.com/package/@improbable-eng/grpc-web).

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Compiling Protobuf files](#compiling-protobuf-files)
    - [Using `ts-proto`](#using-ts-proto)
    - [Using `google-protobuf`](#using-google-protobuf)
  - [Preparing the server](#preparing-the-server)
  - [Client](#client)
    - [Call options](#call-options)
    - [Channels](#channels)
    - [Metadata](#metadata)
    - [Errors](#errors)
    - [Cancelling calls](#cancelling-calls)
    - [Server streaming](#server-streaming)
    - [Client streaming](#client-streaming)
    - [Middleware](#middleware)
      - [Example: Logging](#example-logging)

## Features

- Written in TypeScript for TypeScript.
- Modern API that uses Promises and Async Iterables for streaming.
- Cancelling calls using
  [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
- Middleware support via concise API that uses Async Generators.

## Prerequisites

Global
[`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
is required. A [polyfill](https://www.npmjs.com/package/abort-controller) is
available for older browsers.

## Installation

```
npm install nice-grpc-web
```

## Usage

### Compiling Protobuf files

The recommended way is to use
[`ts-proto`](https://github.com/stephenh/ts-proto).

#### Using `ts-proto`

Install necessary tools:

```
npm install protobufjs long
npm install --save-dev grpc-tools ts-proto
```

> Use `ts-proto` version not older than `1.112.0`.

Given a Protobuf file `./proto/example.proto`, generate TypeScript code into
directory `./compiled_proto`:

```
./node_modules/.bin/grpc_tools_node_protoc \
  --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=./compiled_proto \
  --ts_proto_opt=env=browser,outputServices=nice-grpc,outputServices=generic-definitions,outputJsonMethods=false,useExactTypes=false \
  --proto_path=./proto \
  ./proto/example.proto
```

> You can omit the `--plugin` flag if you invoke this command via
> [npm script](https://docs.npmjs.com/cli/v7/using-npm/scripts).

#### Using `google-protobuf`

Install necessary tools:

```
npm install google-protobuf
npm install --save-dev grpc-tools ts-protoc-gen @types/google-protobuf
```

Given a Protobuf file `./proto/example.proto`, generate JS code and TypeScript
definitions into directory `./compiled_proto`:

```
./node_modules/.bin/grpc_tools_node_protoc \
  --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
  --js_out=import_style=commonjs,binary:./compiled_proto \
  --ts_out=service=grpc-web:./compiled_proto \
  --proto_path=./proto \
  ./proto/example.proto
```

### Preparing the server

Browsers can't talk directly to a gRPC server, so a proxy is required.

It is recommended to use [Envoy proxy](https://www.envoyproxy.io/) with
[`grpc_web` filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/grpc_web_filter).

In Kubernetes, use [Contour ingress controller](https://projectcontour.io/),
which is based on Envoy and has `grpc_web` filter enabled by default.

Note that with Envoy, only unary and server streaming calls are supported. If
you require client streaming and bidirectional streaming calls, use
[grpcwebproxy](https://github.com/improbable-eng/grpc-web/tree/master/go/grpcwebproxy)
and
[websocket transport](https://github.com/improbable-eng/grpc-web/blob/master/client/grpc-web/docs/transport.md#socket-based-transports).

### Client

Consider the following Protobuf definition:

```proto
syntax = "proto3";

package nice_grpc.example;

service ExampleService {
  rpc ExampleUnaryMethod(ExampleRequest) returns (ExampleResponse) {};
}

message ExampleRequest {
  // ...
}
message ExampleResponse {
  // ...
}
```

After compiling Protobuf file, we can create the client:

When compiling Protobufs using `ts-proto`:

```ts
import {createChannel, createClient} from 'nice-grpc-web';
import {
  ExampleServiceClient,
  ExampleServiceDefinition,
} from './compiled_proto/example';

const channel = createChannel('http://localhost:8080');

const client: ExampleServiceClient = createClient(
  ExampleServiceDefinition,
  channel,
);
```

When compiling Protobufs using `google-protobuf`:

```ts
import {createChannel, createClient, Client} from 'nice-grpc';
import {
  ExampleService,
  IExampleService,
} from './compiled_proto/example_grpc_pb';

const channel = createChannel('http://localhost:8080');

const client: Client<IExampleService> = createClient(ExampleService, channel);
```

Further examples use `ts-proto`.

Call the method:

```ts
const response = await client.exampleUnaryMethod(request);
```

With `ts-proto`, request is automatically wrapped with `fromPartial`.

#### Call options

Each client method accepts `CallOptions` as an optional second argument, that
has type:

```ts
type CallOptions = {
  /**
   * Request metadata.
   */
  metadata?: Metadata;
  /**
   * Signal that cancels the call once aborted.
   */
  signal?: AbortSignal;
  /**
   * Called when header is received.
   */
  onHeader?(header: Metadata): void;
  /**
   * Called when trailer is received.
   */
  onTrailer?(trailer: Metadata): void;
};
```

Call options may be augmented by [Middleware](#middleware).

When creating a client, you may specify default call options per method, or for
all methods. This doesn't make much sense for built-in options, but may do for
middleware.

```ts
const client = createClient(ExampleServiceDefinition, channel, {
  '*': {
    // applies for all methods
  },
  exampleUnaryMethod: {
    // applies for single method
  },
});
```

#### Channels

A channel is constructed from an address and optional transport. The following
are equivalent:

```ts
import {createChannel} from 'nice-grpc-web';
import {grpc} from '@improbable-eng/grpc-web';

createChannel('https://example.com:8080');
createChannel('https://example.com:8080', grpc.CrossBrowserHttpTransport());
```

If the port is omitted, it defaults to `80` for `http`, and `443` for `https`.

#### Metadata

Client can send request metadata and receive response header and trailer:

```ts
import {Metadata} from 'nice-grpc-web';

const response = await client.exampleUnaryMethod(request, {
  metadata: Metadata({key: 'value'}),
  onHeader(header: Metadata) {
    // ...
  },
  onTrailer(trailer: Metadata) {
    // ...
  },
});
```

#### Errors

Client calls may throw gRPC errors represented as `ClientError`, that contain
status code and description.

```ts
import {ClientError, Status} from 'nice-grpc-web';
import {ExampleResponse} from './compiled_proto/example';

let response: ExampleResponse | null;

try {
  response = await client.exampleUnaryMethod(request);
} catch (error: unknown) {
  if (error instanceof ClientError && error.code === Status.NOT_FOUND) {
    response = null;
  } else {
    throw error;
  }
}
```

#### Cancelling calls

A client call can be cancelled using
[`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).

```ts
import {isAbortError} from 'abort-controller-x';

const abortController = new AbortController();

client
  .exampleUnaryMethod(request, {
    signal: abortController.signal,
  })
  .catch(error => {
    if (isAbortError(error)) {
      // aborted
    } else {
      throw error;
    }
  });

abortController.abort();
```

#### Server streaming

Consider the following Protobuf definition:

```proto
service ExampleService {
  rpc ExampleStreamingMethod(ExampleRequest)
    returns (stream ExampleResponse) {};
}
```

Client method returns an Async Iterable:

```ts
for await (const response of client.exampleStreamingMethod(request)) {
  // ...
}
```

#### Client streaming

Given a client streaming method:

```proto
service ExampleService {
  rpc ExampleClientStreamingMethod(stream ExampleRequest)
    returns (ExampleResponse) {};
}
```

Client method expects an Async Iterable as its first argument:

```ts
import {ExampleRequest, DeepPartial} from './compiled_proto/example';

async function* createRequest(): AsyncIterable<DeepPartial<ExampleRequest>> {
  for (let i = 0; i < 10; i++) {
    yield request;
  }
}

const response = await client.exampleClientStreamingMethod(createRequest());
```

#### Middleware

Client middleware intercepts outgoing calls allowing to:

- Execute any logic before and after reaching server
- Modify request metadata
- Look into request, response and response metadata
- Send call multiple times for retries or hedging
- Augment call options type to have own configuration

Client middleware is defined as an Async Generator. The most basic no-op
middleware looks like this:

```ts
import {ClientMiddlewareCall, CallOptions} from 'nice-grpc-web';

async function* middleware<Request, Response>(
  call: ClientMiddlewareCall<Request, Response>,
  options: CallOptions,
) {
  return yield* call.next(call.request, options);
}
```

For unary and client streaming methods, the `call.next` generator yields no
items and returns a single response; for server streaming and bidirectional
streaming methods, it yields each response and returns void. By doing
`return yield*` we cover both cases. To handle these cases separately, we can
write a middleware as follows:

```ts
async function* middleware<Request, Response>(
  call: ClientMiddlewareCall<Request, Response>,
  options: CallOptions,
) {
  if (!call.responseStream) {
    const response = yield* call.next(call.request, options);

    return response;
  } else {
    for await (const response of call.next(call.request, options)) {
      yield response;
    }

    return;
  }
}
```

To create a client with middleware, use a client factory:

```ts
import {createClientFactory} from 'nice-grpc-web';

const client = createClientFactory()
  .use(middleware1)
  .use(middleware2)
  .create(ExampleService, channel);
```

A middleware that is attached first, will be invoked last.

You can reuse a single factory to create multiple clients:

```ts
const clientFactory = createClientFactory().use(middleware);

const client1 = clientFactory.create(Service1, channel1);
const client2 = clientFactory.create(Service2, channel2);
```

You can also attach middleware per-client:

```ts
const factory = createClientFactory().use(middlewareA);

const client1 = clientFactory.use(middlewareB).create(Service1, channel1);
const client2 = clientFactory.use(middlewareC).create(Service2, channel2);
```

In the above example, `Service1` client gets `middlewareA` and `middlewareB`,
and `Service2` client gets `middlewareA` and `middlewareC`.

##### Example: Logging

Log all calls:

```ts
import {
  ClientMiddlewareCall,
  CallOptions,
  ClientError,
  Status,
} from 'nice-grpc-web';
import {isAbortError} from 'abort-controller-x';

async function* loggingMiddleware<Request, Response>(
  call: ClientMiddlewareCall<Request, Response>,
  options: CallOptions,
) {
  const {path} = call.method;

  console.log('Client call', path, 'start');

  try {
    const result = yield* call.next(call.request, options);

    console.log('Client call', path, 'end: OK');

    return result;
  } catch (error) {
    if (error instanceof ClientError) {
      console.log(
        'Client call',
        path,
        `end: ${Status[error.code]}: ${error.details}`,
      );
    } else if (isAbortError(error)) {
      console.log('Client call', path, 'cancel');
    } else {
      console.log('Client call', path, `error: ${error?.stack}`);
    }

    throw error;
  }
}
```

[npm-image]: https://badge.fury.io/js/nice-grpc-web.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-web
