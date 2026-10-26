import fs from 'fs/promises';
import getPort from 'get-port';
import * as path from 'path';
import {env} from 'string-env-interpolation';
import {waitUntilUsed} from 'tcp-port-used';
import {GenericContainer} from 'testcontainers';
import {useHostNetwork} from './docker';

let nextId = 0;

export async function startEnvoyProxy(
  listenPort: number,
  backendPort: number,
  tls?: {
    certPath: string;
    keyPath: string;
  },
): Promise<{stop(): void}> {
  const internalListenPort = useHostNetwork ? listenPort : 8080;
  const backendHost = useHostNetwork ? '127.0.0.1' : 'host.docker.internal';
  // In the host network, the default admin port may be taken by another
  // instance or fall into the range of ports used for tests
  const adminPort = useHostNetwork ? await getPort() : 9901;
  const internalCertPath = '/etc/certs/tls.crt';
  const internalKeyPath = '/etc/certs/tls.key';

  const config = env(
    await fs.readFile(
      path.join(__dirname, tls ? 'envoy-tls.yaml' : 'envoy.yaml'),
      'utf8',
    ),
    {
      ADMIN_PORT: adminPort.toString(),
      LISTEN_PORT: internalListenPort.toString(),
      BACKEND_HOST: backendHost,
      BACKEND_PORT: backendPort.toString(),
      TLS_CERT_PATH: internalCertPath,
      TLS_KEY_PATH: internalKeyPath,
    },
  );

  let containerBuilder = new GenericContainer('envoyproxy/envoy:v1.24.0')
    .withCommand([
      'envoy',
      '--config-yaml',
      config,
      '--base-id',
      (nextId++).toString(),
    ])
    .withBindMounts(
      tls
        ? [
            {
              source: tls.certPath,
              target: internalCertPath,
            },
            {
              source: tls.keyPath,
              target: internalKeyPath,
            },
          ]
        : [],
    );

  if (useHostNetwork) {
    containerBuilder = containerBuilder.withNetworkMode('host');
  } else {
    containerBuilder = containerBuilder
      .withExposedPorts({
        container: internalListenPort,
        host: listenPort,
      })
      .withExtraHosts([
        {
          host: 'host.docker.internal',
          ipAddress: 'host-gateway',
        },
      ]);
  }

  const container = await containerBuilder.start();

  await waitUntilUsed(listenPort, 200, 10_000);

  // const logStream = await container.logs();

  // logStream.on('data', data => {
  //   console.log('envoy:', data.toString());
  // });

  return {
    stop() {
      container.stop();
    },
  };
}
