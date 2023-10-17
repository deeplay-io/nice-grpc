import {spawn} from 'child_process';
import * as path from 'path';
import 'jest-os-detection';
import {createChannel, createClient, createServer} from 'nice-grpc';
import {TerminatorMiddleware} from 'nice-grpc-server-middleware-terminator';
import {HealthDefinition, HealthServiceImpl, HealthState} from '.';

test('basic', async () => {
  const server = createServer();

  server.add(HealthDefinition, HealthServiceImpl());

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(HealthDefinition, channel);

  await expect(client.check({service: ''})).resolves.toMatchInlineSnapshot(`
    {
      "status": 1,
    }
  `);

  await expect(client.check({service: 'fake'})).rejects.toMatchInlineSnapshot(
    `[ClientError: /grpc.health.v1.Health/Check NOT_FOUND: Unknown service: 'fake']`,
  );

  channel.close();
  await server.shutdown();
});

test('per-service', async () => {
  const server = createServer();

  const healthState = HealthState();

  server.add(HealthDefinition, HealthServiceImpl(healthState));

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(HealthDefinition, channel);

  await expect(client.check({service: ''})).resolves.toMatchInlineSnapshot(`
    {
      "status": 1,
    }
  `);

  await expect(
    client.check({service: 'MyService'}),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /grpc.health.v1.Health/Check NOT_FOUND: Unknown service: 'MyService']`,
  );

  healthState.setStatus('unhealthy', 'MyService');

  await expect(client.check({service: 'MyService'})).resolves
    .toMatchInlineSnapshot(`
    {
      "status": 2,
    }
  `);

  healthState.setStatus('healthy', 'MyService');

  await expect(client.check({service: 'MyService'})).resolves
    .toMatchInlineSnapshot(`
    {
      "status": 1,
    }
  `);

  healthState.setStatus('unknown', 'MyService');

  await expect(
    client.check({service: 'MyService'}),
  ).rejects.toMatchInlineSnapshot(
    `[ClientError: /grpc.health.v1.Health/Check NOT_FOUND: Unknown service: 'MyService']`,
  );

  channel.close();
  await server.shutdown();
});

test('watch', async () => {
  const terminatorMiddleware = TerminatorMiddleware();

  const server = createServer().use(terminatorMiddleware);

  const healthState = HealthState();

  server.add(HealthDefinition, HealthServiceImpl(healthState));

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  const client = createClient(HealthDefinition, channel);

  const it1 = client.watch({service: ''})[Symbol.asyncIterator]();

  await expect(it1.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": {
        "status": 1,
      },
    }
  `);

  await it1.return?.();

  const it2 = client.watch({service: 'MyService'})[Symbol.asyncIterator]();

  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": {
        "status": 3,
      },
    }
  `);

  healthState.setStatus('unhealthy', 'MyService');

  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": {
        "status": 2,
      },
    }
  `);

  healthState.setStatus('healthy', 'MyService');

  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": {
        "status": 1,
      },
    }
  `);

  healthState.setStatus('unknown', 'MyService');

  await expect(it2.next()).resolves.toMatchInlineSnapshot(`
    {
      "done": false,
      "value": {
        "status": 3,
      },
    }
  `);

  terminatorMiddleware.terminate();

  await expect(it2.next()).rejects.toMatchInlineSnapshot(
    `[ClientError: /grpc.health.v1.Health/Watch UNAVAILABLE: Server shutting down]`,
  );

  channel.close();
  await server.shutdown();
});

test.skipWindows('grpc-health-probe', async () => {
  const server = createServer();

  const healthState = HealthState();

  server.add(HealthDefinition, HealthServiceImpl(healthState));

  const port = await server.listen('127.0.0.1:0');

  const execProbe = (...args: string[]) =>
    new Promise<{stderr: string; code: number | null}>(resolve => {
      const child = spawn(
        `${path.join(
          __dirname,
          '..',
          'grpc-health-probe',
          'grpc-health-probe',
        )}`,
        ['-addr', `127.0.0.1:${port}`, ...args],
      );

      let stderr = '';

      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      child.on('exit', code => {
        resolve({stderr: stderr.trim(), code});
      });
    });

  await expect(execProbe()).resolves.toMatchInlineSnapshot(`
      {
        "code": 0,
        "stderr": "status: SERVING",
      }
    `);

  await expect(execProbe('-service', 'MyService')).resolves
    .toMatchInlineSnapshot(`
      {
        "code": 3,
        "stderr": "error: health rpc failed: rpc error: code = NotFound desc = Unknown service: 'MyService'",
      }
    `);

  healthState.setStatus('unhealthy', 'MyService');

  await expect(execProbe('-service', 'MyService')).resolves
    .toMatchInlineSnapshot(`
      {
        "code": 4,
        "stderr": "service unhealthy (responded with "NOT_SERVING")",
      }
    `);

  healthState.setStatus('healthy', 'MyService');

  await expect(execProbe('-service', 'MyService')).resolves
    .toMatchInlineSnapshot(`
      {
        "code": 0,
        "stderr": "status: SERVING",
      }
    `);

  healthState.setStatus('unknown', 'MyService');

  await expect(execProbe('-service', 'MyService')).resolves
    .toMatchInlineSnapshot(`
      {
        "code": 3,
        "stderr": "error: health rpc failed: rpc error: code = NotFound desc = Unknown service: 'MyService'",
      }
    `);

  await server.shutdown();
});
