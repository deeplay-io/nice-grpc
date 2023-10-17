import fs from 'fs/promises';
import * as path from 'path';
import {env} from 'string-env-interpolation';
import {GenericContainer, Wait} from 'testcontainers';
import * as tmp from 'tmp';

export async function startTraefikProxy(
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

  const tempDir = tmp.dirSync();

  const config = env(
    await fs.readFile(path.join(__dirname, 'traefik.yaml'), 'utf8'),
    {
      LISTEN_PORT: internalListenPort.toString(),
    },
  );

  await fs.writeFile(path.join(tempDir.name, 'traefik.yaml'), config, 'utf8');

  const providerConfig = env(
    await fs.readFile(
      path.join(
        __dirname,
        tls ? 'traefik-provider-tls.yaml' : 'traefik-provider.yaml',
      ),
      'utf8',
    ),
    {
      BACKEND_HOST: backendHost,
      BACKEND_PORT: backendPort.toString(),
      TLS_CERT_PATH: internalCertPath,
      TLS_KEY_PATH: internalKeyPath,
    },
  );

  await fs.writeFile(
    path.join(tempDir.name, 'traefik-provider.yaml'),
    providerConfig,
    'utf8',
  );

  // Traefik can return 404 for a while after start.
  // See https://github.com/traefik/traefik/issues/7347
  // Once the gRPC server is reached it returns 415.
  let waitStrategy = Wait.forHttp(
    '/fake-probe',
    internalListenPort,
  ).forStatusCode(415);

  if (tls) {
    waitStrategy = waitStrategy.usingTls().allowInsecure();
  }

  const container = await new GenericContainer('traefik:v3.0.0-beta2')
    .withBindMounts([
      ...(tls
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
        : []),
      {
        source: tempDir.name,
        target: '/etc/traefik',
      },
    ])
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
    .withWaitStrategy(waitStrategy)
    .start();

  // const logStream = await container.logs();

  // logStream.on('data', data => {
  //   console.log('traefik:', data.toString());
  // });

  return {
    stop() {
      container.stop();
    },
  };
}
