import * as path from 'path';
import {spawn} from 'child_process';
import {waitUntilUsed} from 'tcp-port-used';

const executablePath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'grpcwebproxy',
  process.platform === 'win32' ? `grpcwebproxy.exe` : 'grpcwebproxy',
);

export async function startGrpcWebProxy(
  listenPort: number,
  backendPort: number,
): Promise<{stop(): void}> {
  const childProcess = spawn(
    executablePath,
    [
      `--server_http_debug_port=${listenPort}`,
      `--run_tls_server=false`,

      `--server_bind_address=0.0.0.0`,
      `--backend_addr=localhost:${backendPort}`,
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
