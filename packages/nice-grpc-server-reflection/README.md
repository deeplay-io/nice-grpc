# nice-grpc-server-reflection [![npm version][npm-image]][npm-url]

[Server Reflection](https://github.com/grpc/grpc/blob/master/doc/server-reflection.md)
for [nice-grpc](https://github.com/deeplay-io/nice-grpc).

Allows to use tools like [grpcurl](https://github.com/fullstorydev/grpcurl)
without the need to pass `.proto` files.

## Installation

```
npm install nice-grpc-server-reflection
```

## Usage

Add the following flags to `protoc` command:

```
--descriptor_set_out=path/to/protoset.bin --include_imports
```

Add `ServerReflection` service implementation to gRPC server:

```ts
import {createServer} from 'nice-grpc';
import {
  ServerReflectionDefinition,
  ServerReflection,
} from 'nice-grpc-server-reflection';
import * as fs from 'fs';

const server = createServer();

// add our own service
server.add(MyService, myServiceImpl);

// add server reflection service
server.add(
  ServerReflectionDefinition,
  ServerReflection(
    fs.readFileSync(path.join('path', 'to', 'protoset.bin')),
    // specify fully-qualified names of exposed services
    [MyService.fullName],
  ),
);
```

[npm-image]: https://badge.fury.io/js/nice-grpc-server-reflection.svg
[npm-url]: https://badge.fury.io/js/nice-grpc-server-reflection
