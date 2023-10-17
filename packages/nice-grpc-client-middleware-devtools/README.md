# nice-grpc-client-middleware-devtools [![npm version][npm-image]][npm-url]

Client middleware for [nice-grpc](https://github.com/deeplay-io/nice-grpc) that
enables seeing grpc-web requests in [grpc-web-tools](https://github.com/SafetyCulture/grpc-web-devtools).

## Installation

```
npm install nice-grpc-client-middleware-devtools
```

## Usage

```ts
import {
  createClientFactory,
  createChannel,
  ClientError,
  Status,
} from 'nice-grpc';
import {devtoolsLoggingMiddleware} from 'nice-grpc-client-middleware-devtools';

const clientFactory = createClientFactory().use(devtoolsLoggingMiddlware);

const channel = createChannel(address);
const client = clientFactory.create(ExampleService, channel);

const response = await client.exampleMethod(request);
// The request and response will be visible in the Browser extension
```

Alternatively, only logging for unary requests can be achieved by using `devtoolsUnaryLoggingMiddleware`
or logging for streaming requests by using `devtoolsStreamLoggingMiddleware`.

[npm-image]: https://badge.fury.io/js/nice-grpc-client-middleware-devtools.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-client-middleware-devtools