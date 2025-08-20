import {
  ServerError,
  Status,
  createChannel,
  createClient,
  createServer,
} from 'nice-grpc';

import {readFileSync} from 'fs';

import {ServerReflection, ServerReflectionService} from '.';
import {TestDefinition} from '../fixtures/test';
import {ServerReflectionRequest} from './proto/grpc/reflection/v1/reflection_pb';

async function* arrayToIter<T>(requests: T[]): AsyncIterable<T> {
  for (const request of requests) {
    yield await Promise.resolve(request);
  }
}

test('list', async () => {
  const protoset = readFileSync('fixtures/test.protoset.bin');
  const server = createServer();

  server.add(TestDefinition, {
    testUnary: async () => {
      throw new ServerError(Status.UNIMPLEMENTED, 'unimplemented for test');
    },
  });

  server.add(
    ServerReflectionService,
    ServerReflection(protoset, [TestDefinition.fullName]),
  );

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(ServerReflectionService, channel);

  const req: ServerReflectionRequest = new ServerReflectionRequest();
  req.setListServices('any text you want');

  let count = 0;
  for await (const result of client.serverReflectionInfo(arrayToIter([req]))) {
    count++;
    if (count === 1) {
      expect(
        result
          .getListServicesResponse()
          ?.getServiceList()
          ?.map(x => x.getName()),
      ).toEqual([TestDefinition.fullName]);
    } else {
      throw new Error('reflection service returned too many results');
    }
  }
  expect(count).toBe(1);

  channel.close();
  await server.shutdown();
});

test('get', async () => {
  const protoset = readFileSync('fixtures/test.protoset.bin');
  const server = createServer();

  server.add(TestDefinition, {
    testUnary: async () => {
      throw new ServerError(Status.UNIMPLEMENTED, 'unimplemented for test');
    },
  });

  server.add(
    ServerReflectionService,
    ServerReflection(protoset, [TestDefinition.fullName]),
  );

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(ServerReflectionService, channel);

  const req: ServerReflectionRequest = new ServerReflectionRequest();
  req.setFileContainingSymbol(TestDefinition.fullName);

  let count = 0;
  for await (const result of client.serverReflectionInfo(arrayToIter([req]))) {
    count++;
    if (count === 1) {
      const fd = result
        .getFileDescriptorResponse()
        ?.getFileDescriptorProtoList();
      expect(fd?.length).toBe(1);
      const actual: Buffer = Buffer.from(fd![0]);
      expect(protoset.indexOf(actual)).toBeGreaterThan(-1);
      // slice and subarray include the metadata such as the version annotation
      const version = Buffer.from('1.0.0', 'utf-8');
      expect(actual.indexOf(version)).toBeGreaterThan(-1);
    } else {
      throw new Error('reflection service returned too many results');
    }
  }
  expect(count).toBe(1);

  channel.close();
  await server.shutdown();
});
