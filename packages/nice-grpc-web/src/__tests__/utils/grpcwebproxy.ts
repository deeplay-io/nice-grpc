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

export async function startProxy(
  listenPort: number,
  backendAddress: string,
): Promise<{stop(): void}> {
  const childProcess = spawn(
    executablePath,
    [
      `--server_bind_address=0.0.0.0`,
      `--server_http_debug_port=${listenPort}`,
      `--run_tls_server=false`,
      `--backend_addr=${backendAddress}`,
      `--use_websockets=true`,
      `--allow_all_origins=true`,
      `--server_http_max_read_timeout=180s`,
      `--server_http_max_write_timeout=180s`,
    ],
    // {
    //   stdio: 'inherit',
    // },
  );

  await waitUntilUsed(listenPort);

  return {
    stop() {
      childProcess.kill();
    },
  };
}
