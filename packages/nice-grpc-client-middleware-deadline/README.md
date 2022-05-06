# nice-grpc-client-middleware-deadline [![npm version][npm-image]][npm-url]

Client middleware for [nice-grpc](https://github.com/deeplay-io/nice-grpc) that
adds support for setting deadline for a call, after which the call will get
cancelled, and a `ClientError` with status code `DEADLINE_EXCEEDED` will be
thrown.

## Installation

```
npm install nice-grpc-client-middleware-deadline
```

## Usage

```ts
import {
  createClientFactory,
  createChannel,
  ClientError,
  Status,
} from 'nice-grpc';
import {deadlineMiddleware} from 'nice-grpc-client-middleware-deadline';
import {addSeconds} from 'date-fns';

const clientFactory = createClientFactory().use(deadlineMiddleware);

const channel = createChannel(address);
const client = clientFactory.create(ExampleService, channel);

try {
  const response = await client.exampleMethod(request, {
    deadline: addSeconds(new Date(), 15),
  });
} catch (error: unknown) {
  if (error instanceof ClientError && error.code === Status.DEADLINE_EXCEEDED) {
    // timed out
  } else {
    throw error;
  }
}
```

Alternatively, you can specify deadline as a relative offset in milliseconds:

```ts
import ms from 'ms';

const response = await client.exampleMethod(request, {
  deadline: ms('15s'),
});
```

[npm-image]: https://badge.fury.io/js/nice-grpc-client-middleware-deadline.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-client-middleware-deadline
