# nice-grpc-web [![npm version][npm-image]][npm-url] <!-- omit in toc -->

A Browser gRPC client library that is nice to you.

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
- [Compatibility](#compatibility)

## Features

- Written in TypeScript for TypeScript.
- Modern API that uses Promises and Async Iterables for streaming.
- Easy cancellation propagation with
  [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
- Middleware support via concise API that uses Async Generators.

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

When running on Windows command line, you may need to wrap the `ts_proto_opt`
value with double quotes:

```
--ts_proto_opt="outputServices=nice-grpc,outputServices=generic-definitions,useExactTypes=false"
```

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

Browsers can't talk directly to a gRPC server and require a specialized proxy.

It is recommended to use [Envoy proxy](https://www.envoyproxy.io/) with
[`grpc_web` filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/grpc_web_filter).
For an example of how to configure Envoy, see the
[config that we use in our tests](/packages/nice-grpc-web/test-server/envoy-tls.yaml).

In Kubernetes, use [Contour ingress controller](https://projectcontour.io/),
which is based on Envoy and has `grpc_web` filter enabled by default.

Another option is to use [traefik](https://traefik.io/traefik/) with
[`GrpcWeb` middleware](https://doc.traefik.io/traefik/master/middlewares/http/grpcweb/)
(available in traefik 3.0.0-beta1).

Another option is to use
[improbable-eng grpcwebproxy](https://github.com/improbable-eng/grpc-web/tree/master/go/grpcwebproxy)
which is not recommended unless you require [Websocket transport](#channels).
Even if you do, we advise you to use
[`grpcwebproxy` binaries from our fork](https://github.com/aikoven/grpc-web/releases/tag/v0.0.1)
which contain a few fixes.

gRPC-Web is
[supported natively](https://learn.microsoft.com/en-us/aspnet/core/grpc/grpcweb?view=aspnetcore-7.0)
by ASP.NET Core.

In all cases, it is highly recommended to use `http2`, which in turn requires
`https` in all browsers.

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
middleware, for example,
[nice-grpc-client-middleware-deadline](/packages/nice-grpc-client-middleware-deadline):

```ts
const client = createClient(ExampleServiceDefinition, channel, {
  '*': {
    // applies for all methods
    deadline: 30_000,
  },
  exampleUnaryMethod: {
    // applies for single method
    deadline: 10_000,
  },
});
```

To add default metadata, instead use a middleware that merges it with the
metadata passed to the call:

```ts
const token = '...';

const client = createClientFactory().use((call, options) =>
  call.next(call.request, {
    ...options,
    metadata: Metadata(options.metadata).set(
      'Authorization',
      `Bearer ${token}`,
    ),
  }),
);
```

#### Channels

A channel is constructed from an address and optional transport. The following
are equivalent:

```ts
import {createChannel, FetchTransport} from 'nice-grpc-web';

createChannel('https://example.com:8080');
createChannel('https://example.com:8080', FetchTransport());
```

If the port is omitted, it defaults to `80` for `http`, and `443` for `https`.

A non-standard `WebsocketTransport` is also available, that only works with
[improbable-eng grpcwebproxy](https://github.com/improbable-eng/grpc-web/tree/master/go/grpcwebproxy)
and allows to overcome some limitations (see [Compatibility](#compatibility)).
It is still recommended to use `FetchTransport` whenever possible.

To support older NodeJS versions, we also provide `NodeHttpTransport` which is
based on `http` and `https` modules (see [Compatibility](#compatibility)).

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

> **Note** Most `fetch` implementations only receive response header when the
> first chunk of the response body is received. This means that `onHeader` will
> be called just before the response (or the first response message in case of
> server streaming) is received, even if the server sends the header before
> sending the response.

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

> **Note** Most browsers don't support streaming request bodies. See
> [Compatibility](#compatibility) for more details.

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

## Compatibility

This library was tested against:

- Chrome 71+
- Firefox 73+
- Safari 12.1+
- Android 6+
- iOS 10.3+
- NodeJS 16.15+

It might work in older browsers as well.

The library's default `FetchTransport` requires
[`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch) to be
available globally and support for reading a `ReadableStream` from a `Response`
body. See [compatibility table](https://caniuse.com/mdn-api_response_body).
There is no polyfill for this, so this requirement defines the minimum browser
versions. That said, the [Websocket transport with `grpcwebproxy`](#channels)
should work in even older browsers.

Global
[`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
is required. A [polyfill](https://www.npmjs.com/package/abort-controller) is
available.

This library works in NodeJS 18+ out of the box. It can also be used in NodeJS
16.15 with the `--experimental-fetch` flag; also client streams require global
`ReadableStream` constructor which can be added manually:

```ts
global.ReadableStream ??= require('stream/web').ReadableStream;
```

It does **not** work with `node-fetch`, because it does not support
`ReadableStream` in `Response` body.

For older NodeJS versions we provide `NodeHttpTransport` which is based on
`http` and `https` modules.

Most browsers do not support sending streams in `fetch` requests. This means
that [client streaming](#client-streaming) and bidirectional streaming will not
work. The only browser that supports client streams is Chrome 105+ (and other
Chromium-based browsers, see
[compatibility table](https://caniuse.com/mdn-api_request_request_request_body_readablestream)),
and only over `http2`, which in turn requires `https`. Client streams work in
NodeJS native `fetch` implementation as well. Note, however, that `fetch`
streams are currently
[half-duplex](https://github.com/whatwg/fetch/issues/1254), which means that any
response data will be buffered until the request stream is sent until the end.
This unfortunately makes it impossible to use infinite bidirectional streaming.
To overcome this limitation, it is recommended to design your API to use only
unary and server streaming methods. If you still need to use client streams in
the browser, you can use a [Websocket transport with `grpcwebproxy`](#channels).

Browser compatibility is tested with help of
[BrowserStack](https://www.browserstack.com/).

[npm-image]: https://badge.fury.io/js/nice-grpc-web.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-web
