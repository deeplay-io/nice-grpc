import {spawn} from 'child_process';
import * as path from 'path';

const executablePath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'browserstack-local',
  process.platform === 'win32'
    ? `browserstack-local.exe`
    : 'browserstack-local',
);

export function startBrowserstackLocal(
  key: string,
  localIdentifier?: string,
): {stop(): void} {
  const childProcess = spawn(
    executablePath,
    [
      '--key',
      key,
      '--verbose',
      '--include-hosts',
      'localhost',
      ...(localIdentifier ? ['--local-identifier', localIdentifier] : []),
    ],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );

  return {
    stop() {
      childProcess.kill();
    },
  };
}
