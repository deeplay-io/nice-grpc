import fs from 'fs/promises';
import * as path from 'path';
import {env} from 'string-env-interpolation';
import {waitUntilUsed} from 'tcp-port-used';
import {GenericContainer} from 'testcontainers';

const DOCKER_HOST_GATEWAY = process.env.DOCKER_HOST_GATEWAY || 'host-gateway';

let nextId = 0;

export async function startEnvoyProxy(
  listenPort: number,
  backendPort: number,
): Promise<{stop(): void}> {
  const internalListenPort = 8080;

  const config = env(
    await fs.readFile(path.join(__dirname, 'envoy.yaml'), 'utf8'),
    {
      LISTEN_PORT: internalListenPort.toString(),
      BACKEND_HOST: 'host.docker.internal',
      BACKEND_PORT: backendPort.toString(),
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
      container: internalListenPort,
      host: listenPort,
    })
    .withExtraHosts([
      {
        host: 'host.docker.internal',
        ipAddress: DOCKER_HOST_GATEWAY,
      },
    ])
    .start();

  await waitUntilUsed(listenPort, 200, 3_000);

  return {
    stop() {
      container.stop();
    },
  };
}
