# nice-grpc-error-details [![npm version][npm-image]][npm-url]

[Rich error model](https://grpc.io/docs/guides/error/#richer-error-model)
implementation for [nice-grpc](https://github.com/deeplay-io/nice-grpc).

> This package is **experimental** and its API should not be considered stable.

Provides extensions to
[`ServerError`](../nice-grpc-common/src/server/ServerError.ts) and
[`ClientError`](../nice-grpc-common/src/client/ClientError.ts) which carry extra
[error details](https://github.com/googleapis/googleapis/blob/master/google/rpc/error_details.proto),
as well as server and client middleware to communicate these details via
trailing metadata.

## Installation

    npm install nice-grpc-error-details

## Usage

### Server

Attach the middleware to a server:

```ts
import {errorDetailsServerMiddleware} from 'nice-grpc-error-details';

const server = createServer().use(errorDetailsServerMiddleware);
```

Throw [`RichServerError`](src/server/RichServerError.ts) from a service
implementation method:

```ts
import {ServerError, Status} from 'nice-grpc';
import {RichServerError, BadRequest} from 'nice-grpc-error-details';

const exampleServiceImpl: ServiceImplementation<
  typeof ExampleServiceDefinition
> = {
  async exampleUnaryMethod(
    request: ExampleRequest,
  ): Promise<DeepPartial<ExampleResponse>> {
    if (!request.someField)
      throw new RichServerError(
        Status.INVALID_ARGUMENT,
        "Missing required field 'some_field'",
        [
          BadRequest.fromPartial({
            fieldViolations: [
              {
                field: 'some_field',
                description: 'Field is required',
              },
            ],
          }),
        ],
      );

    // ... method logic
  },
};
```

### Client

Attach the middleware to a client factory:

```ts
import {errorDetailsClientMiddleware} from 'nice-grpc-error-details';

const clientFactory = createClientFactory().use(errorDetailsClientMiddleware);
```

If an error with details is returned from a server, the client will receive
[`RichClientError`](src/client/RichClientError.ts):

```ts
import {Status} from 'nice-grpc';
import {RichClientError, BadRequest} from 'nice-grpc-error-details';

const fieldViolations: BadRequest_FieldViolation[] = [];

try {
  await client.exampleUnaryMethod(request);
} catch (error: unknown) {
  if (
    error instanceof RichClientError &&
    error.code === Status.INVALID_ARGUMENT
  ) {
    // loop through error details to find `BadRequest`
    for (const detail of error.extra) {
      if (detail.$type === BadRequest.$type) {
        fieldViolations.push(...detail.fieldViolations);
      }
    }
  } else {
    throw error;
  }
}
```

[npm-image]: https://badge.fury.io/js/nice-grpc-error-details.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-error-details
