import {Options} from '@wdio/types';
import * as fs from 'fs';
import * as path from 'path';
import * as selfsigned from 'selfsigned';
import {WebSocketServer} from 'ws';
import {startMockServer} from './test-server/server';
import {randomUUID} from 'crypto';

const {
  USE_BROWSERSTACK,
  USE_HEADLESS_BROWSER,
  BROWSERSTACK_USERNAME,
  BROWSERSTACK_KEY,
  BROWSER_NAME,
  BROWSERSTACK_BROWSER_VERSION,
  BROWSERSTACK_OS,
  BROWSERSTACK_OS_VERSION,
} = process.env;

const useBrowserstack = USE_BROWSERSTACK === 'true';

let mockServer: WebSocketServer | undefined;

export const config: Options.Testrunner = {
  runner: [
    'browser',
    {
      headless: USE_HEADLESS_BROWSER === 'true',
      viteConfig: {
        optimizeDeps: {
          include: ['nice-grpc-common'],
        },
        build: {
          commonjsOptions: {
            include: [/nice-grpc-common/, /node_modules/],
          },
        },
      },
    },
  ],
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './tsconfig.json',
      transpileOnly: true,
    },
  },

  specs: ['src/__tests__/**/*.ts', 'src/**/*.test.ts'],
  exclude: [
    'src/__tests__/utils/**/*.ts',
    /**
     * Exclude tests of legacy grpc-web protoc codegen because Vite (used by
     * wdio) does not support loading of non-ESM modules.
     *
     * We still test it in Node.js environment.
     */
    'src/__tests__/grpc-web.ts',
  ],

  user: useBrowserstack ? BROWSERSTACK_USERNAME : undefined,
  key: useBrowserstack ? BROWSERSTACK_KEY : undefined,

  bail: 1,

  services: compact([
    useBrowserstack && [
      'browserstack',
      {
        browserstackLocal: true,
        testObservability: true,
        testObservabilityOptions: {
          projectName: 'nice-grpc-web',
        },
        opts: {
          localIdentifier: randomUUID(),
        },
      },
    ],
  ]),

  capabilities: [
    {
      browserName: BROWSER_NAME ?? 'chrome',
      acceptInsecureCerts: true,
      'bstack:options': {
        local: true,
        disableCorsRestrictions: true,
        idleTimeout: 300,
        // wsLocalSupport: true,
        // networkLogs: true,
        browserVersion: BROWSERSTACK_BROWSER_VERSION,
        os: BROWSERSTACK_OS,
        osVersion: BROWSERSTACK_OS_VERSION,
      },
    },
  ],

  logLevel: 'info',

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    retries: 2,
    timeout: 300_000,
  },
  reporters: ['spec'],

  async onPrepare(config) {
    let hostname: string;
    let certPath: string;
    let keyPath: string;

    if (useBrowserstack) {
      hostname = 'nice-grpc-web-tests.deeplay.io';
      certPath = path.resolve(__dirname, './test-server/cert/tls.crt');
      keyPath = path.resolve(__dirname, './test-server/cert/tls.key');
    } else {
      hostname = '127.0.0.1';
      certPath = path.resolve(__dirname, './test-server/cert/self-signed.crt');
      keyPath = path.resolve(__dirname, './test-server/cert/self-signed.key');

      const cert = selfsigned.generate(
        [{name: 'commonName', value: hostname}],
        {
          keySize: 2048,
        },
      );

      fs.writeFileSync(certPath, cert.cert);
      fs.writeFileSync(keyPath, cert.private);

      process.on('beforeExit', () => {
        fs.unlinkSync(certPath);
        fs.unlinkSync(keyPath);
      });
    }

    mockServer = startMockServer({
      certPath,
      keyPath,
      enableDebugLogs:
        config.logLevel === 'debug' || config.logLevel === 'trace',
    });
  },

  onComplete() {
    mockServer?.close();
  },
};

function compact<T>(array: Array<T | null | undefined | false>): T[] {
  return array.filter((value): value is T => !!value);
}
