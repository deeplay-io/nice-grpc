import {mockRandom, resetMockRandom} from 'jest-mock-random';
import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {retryMiddleware} from '.';
import {TestDefinition} from '../fixtures/test';

beforeEach(() => {
  mockRandom(0.5);
});

afterEach(() => {
  resetMockRandom();
});

test('basic', async () => {
  const server = createServer();

  const testMethodMock = jest.fn(() => {
    throw new ServerError(Status.UNAVAILABLE, 'Unavailable');
  });

  server.add(TestDefinition, {
    test: testMethodMock,
    testIdempotent() {
      throw new ServerError(Status.UNIMPLEMENTED, 'Unimplemented');
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(retryMiddleware)
    .create(TestDefinition, channel);

  const onRetryableErrorMock = jest.fn();

  await expect(
    client.test(
      {},
      {
        onRetryableError: onRetryableErrorMock,
      },
    ),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/Test UNAVAILABLE: Unavailable]`,
  );
  expect(testMethodMock).toHaveBeenCalledTimes(1);
  expect(onRetryableErrorMock.mock.calls).toMatchInlineSnapshot(`Array []`);

  channel.close();
  await server.shutdown();
});

test('retries enabled', async () => {
  const server = createServer();

  const testMethodMock = jest.fn(() => {
    throw new ServerError(Status.UNAVAILABLE, 'Unavailable');
  });

  server.add(TestDefinition, {
    test: testMethodMock,
    testIdempotent() {
      throw new ServerError(Status.UNIMPLEMENTED, 'Unimplemented');
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(retryMiddleware)
    .create(TestDefinition, channel);

  const onRetryableErrorMock = jest.fn();

  await expect(
    client.test(
      {},
      {
        retry: true,
        onRetryableError: onRetryableErrorMock,
      },
    ),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/Test UNAVAILABLE: Unavailable]`,
  );
  expect(testMethodMock).toHaveBeenCalledTimes(2);
  expect(onRetryableErrorMock.mock.calls).toMatchInlineSnapshot(`
Array [
  Array [
    [ClientError: /nice_grpc.test.Test/Test UNAVAILABLE: Unavailable],
    0,
    750,
  ],
]
`);

  channel.close();
  await server.shutdown();
});

test('idempotent', async () => {
  const server = createServer();

  const testMethodMock = jest.fn(() => {
    throw new ServerError(Status.UNAVAILABLE, 'Unavailable');
  });

  server.add(TestDefinition, {
    testIdempotent: testMethodMock,
    test() {
      throw new ServerError(Status.UNIMPLEMENTED, 'Unimplemented');
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClientFactory()
    .use(retryMiddleware)
    .create(TestDefinition, channel);

  const onRetryableErrorMock = jest.fn();

  await expect(
    client.testIdempotent(
      {},
      {
        onRetryableError: onRetryableErrorMock,
        retryMaxAttempts: 2,
      },
    ),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestIdempotent UNAVAILABLE: Unavailable]`,
  );
  expect(testMethodMock).toHaveBeenCalledTimes(3);
  expect(onRetryableErrorMock.mock.calls).toMatchInlineSnapshot(`
Array [
  Array [
    [ClientError: /nice_grpc.test.Test/TestIdempotent UNAVAILABLE: Unavailable],
    0,
    750,
  ],
  Array [
    [ClientError: /nice_grpc.test.Test/TestIdempotent UNAVAILABLE: Unavailable],
    1,
    1500,
  ],
]
`);

  channel.close();
  await server.shutdown();
});
