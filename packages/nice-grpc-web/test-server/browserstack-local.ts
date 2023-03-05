import {spawn} from 'child_process';
import * as path from 'path';

const executablePath = path.join(
  __dirname,
  '..',
  'browserstack-local',
  process.platform === 'win32'
    ? `browserstack-local.exe`
    : 'browserstack-local',
);

export async function startBrowserstackLocal(
  key: string,
  localIdentifier?: string,
): Promise<{stop(): void}> {
  const childProcess = spawn(
    executablePath,
    [
      '--key',
      key,
      '--verbose',
      ...(localIdentifier ? ['--local-identifier', localIdentifier] : []),
    ],
    {
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Browserstack local took too long to start'));
    }, 15_000);

    childProcess.stdout.on('data', data => {
      process.stdout.write(data);

      if (data.toString().includes('Press Ctrl-C to exit')) {
        clearTimeout(timer);
        resolve();
      }
    });

    childProcess.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Browserstack local exited with code ${code}`));
    });
  });

  return {
    stop() {
      childProcess.kill();
    },
  };
}
