import fs from 'fs/promises';
import * as path from 'path';
import {env} from 'string-env-interpolation';
import {GenericContainer} from 'testcontainers';

let nextId = 0;

export async function startEnvoyProxy(
  listenPort: number,
  backendPort: number,
  tls?: {
    certPath: string;
    keyPath: string;
  },
): Promise<{stop(): void}> {
  const internalListenPort = 8080;
  const backendHost = 'host.docker.internal';
  const internalCertPath = '/etc/certs/tls.crt';
  const internalKeyPath = '/etc/certs/tls.key';

  const config = env(
    await fs.readFile(
      path.join(__dirname, tls ? 'envoy-tls.yaml' : 'envoy.yaml'),
      'utf8',
    ),
    {
      LISTEN_PORT: internalListenPort.toString(),
      BACKEND_HOST: backendHost,
      BACKEND_PORT: backendPort.toString(),
      TLS_CERT_PATH: internalCertPath,
      TLS_KEY_PATH: internalKeyPath,
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
    )
    .withExposedPorts({
      container: internalListenPort,
      host: listenPort,
    })
    .withExtraHosts([
      {
        host: 'host.docker.internal',
        ipAddress: 'host-gateway',
      },
    ])
    .start();

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
