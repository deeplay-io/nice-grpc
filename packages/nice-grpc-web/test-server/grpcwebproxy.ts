import * as path from 'path';
import {spawn} from 'child_process';
import {waitUntilUsed} from 'tcp-port-used';

const executablePath = path.join(
  __dirname,
  '..',
  'grpcwebproxy',
  process.platform === 'win32' ? `grpcwebproxy.exe` : 'grpcwebproxy',
);

export async function startGrpcWebProxy(
  listenPort: number,
  backendPort: number,
  tls?: {
    certPath: string;
    keyPath: string;
  },
): Promise<{stop(): void}> {
  const childProcess = spawn(
    executablePath,
    [
      ...(tls
        ? [
            `--server_http_tls_port=${listenPort}`,
            `--server_tls_cert_file=${tls.certPath}`,
            `--server_tls_key_file=${tls.keyPath}`,
            `--run_http_server=false`,
          ]
        : [`--server_http_debug_port=${listenPort}`, `--run_tls_server=false`]),

      `--server_bind_address=0.0.0.0`,
      `--backend_addr=127.0.0.1:${backendPort}`,
      `--use_websockets=true`,
      `--allow_all_origins=true`,
    ],
    // {
    //   stdio: 'inherit',
    // },
  );

  await waitUntilUsed(listenPort, 200, 10_000);

  return {
    stop() {
      childProcess.kill();
    },
  };
}
