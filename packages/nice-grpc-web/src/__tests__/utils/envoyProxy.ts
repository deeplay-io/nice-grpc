import fs from 'fs/promises';
import * as path from 'path';
import {env} from 'string-env-interpolation';
import {waitUntilUsed} from 'tcp-port-used';
import {GenericContainer} from 'testcontainers';

let nextId = 0;

export async function startEnvoyProxy(
  listenPort: number,
  backendAddress: string,
): Promise<{stop(): void}> {
  const [backendHost, backendPort] = backendAddress.split(':') as [
    string,
    string,
  ];

  const config = env(
    await fs.readFile(path.join(__dirname, 'envoy.yaml'), 'utf8'),
    {
      LISTEN_PORT: '8080',
      BACKEND_HOST: 'host.docker.internal',
      BACKEND_PORT: backendPort,
    },
  );

  const container = await new GenericContainer('envoyproxy/envoy:v1.24.0')
    .withCommand([
      'envoy',
      '--config-yaml',
      config,
      '--base-id',
      (nextId++).toString(),
    ])
    .withExposedPorts({
      container: 8080,
      host: listenPort,
    })
    .start();

  await waitUntilUsed(listenPort, 200, 30_000);

  return {
    stop() {
      container.stop();
    },
  };
}
