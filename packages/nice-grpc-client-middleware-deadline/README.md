# nice-grpc-client-middleware-deadline [![npm version][npm-image]][npm-url]

Deadline client middleware for
[nice-grpc](https://github.com/deeplay-io/nice-grpc).

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

[npm-image]: https://badge.fury.io/js/nice-grpc-client-middleware-deadline.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-client-middleware-deadline
