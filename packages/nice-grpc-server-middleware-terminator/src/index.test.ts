import {forever, isAbortError} from 'abort-controller-x';
import defer from 'defer-promise';
import {createChannel, createClient, createServer} from 'nice-grpc';
import AbortController from 'node-abort-controller';
import {TerminatorMiddleware} from '.';
import {TestDefinition} from '../fixtures/test';

test('basic', async () => {
  const terminatorMiddleware = TerminatorMiddleware();

  const server = createServer().use(terminatorMiddleware);

  const serverRequestStartDeferred = defer<void>();
  const serverAbortDeferred = defer<void>();

  server.add(TestDefinition, {
    async testUnary(request, context) {
      context.abortOnTerminate();

      serverRequestStartDeferred.resolve();

      try {
        return await forever(context.signal);
      } catch (err) {
        if (isAbortError(err)) {
          serverAbortDeferred.resolve();
        }

        throw err;
      }
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClient(TestDefinition, channel);

  const promise = client.testUnary({});

  await serverRequestStartDeferred.promise;

  terminatorMiddleware.terminate();

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary UNAVAILABLE: Server shutting down]`,
  );
  await serverAbortDeferred.promise;

  channel.close();
  await server.shutdown();
});

test('terminate before call start', async () => {
  const terminatorMiddleware = TerminatorMiddleware();

  const server = createServer().use(terminatorMiddleware);

  server.add(TestDefinition, {
    async testUnary(request, context) {
      context.abortOnTerminate();

      expect(context.signal.aborted).toBe(true);

      return await forever(context.signal);
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClient(TestDefinition, channel);

  terminatorMiddleware.terminate();

  await expect(client.testUnary({})).rejects.toMatchInlineSnapshot(
    `[ClientError: /nice_grpc.test.Test/TestUnary UNAVAILABLE: Server shutting down]`,
  );

  channel.close();
  await server.shutdown();
});

test('cancel', async () => {
  const terminatorMiddleware = TerminatorMiddleware();

  const server = createServer().use(terminatorMiddleware);

  const serverRequestStartDeferred = defer<void>();
  const serverAbortDeferred = defer<void>();

  server.add(TestDefinition, {
    async testUnary(request, context) {
      context.abortOnTerminate();

      serverRequestStartDeferred.resolve();

      try {
        return await forever(context.signal);
      } catch (err) {
        if (isAbortError(err)) {
          serverAbortDeferred.resolve();
        }

        throw err;
      }
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);
  const client = createClient(TestDefinition, channel);

  const abortController = new AbortController();

  const promise = client.testUnary({}, {signal: abortController.signal});

  await serverRequestStartDeferred.promise;

  abortController.abort();

  await expect(promise).rejects.toMatchInlineSnapshot(
    `[AbortError: The operation has been aborted]`,
  );

  await serverAbortDeferred.promise;

  channel.close();
  await server.shutdown();
});
