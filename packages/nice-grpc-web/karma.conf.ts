import {Config, CustomLauncher} from 'karma';
import * as wdio from 'webdriverio';
import {KarmaTypescriptConfig} from 'karma-typescript';
import {randomUUID} from 'crypto';
import {startMockServer} from './src/__tests__/utils/mockServer/server';
import {startBrowserstackLocal} from './src/__tests__/utils/browserstack-local';

declare module 'karma' {
  export interface ConfigOptions {
    karmaTypescriptConfig?: KarmaTypescriptConfig;
  }

  export interface ClientOptions {
    jasmine?: {
      random?: boolean;
      seed?: string;
      oneFailurePerSpec?: boolean;
      failFast?: boolean;
      timeoutInterval?: number;
    };
  }

  export interface CustomLauncher {
    options?: wdio.RemoteOptions;
  }
}

export default (config: Config & Record<string, unknown>) => {
  config.set({
    // logLevel: config.LOG_DEBUG,

    frameworks: ['jasmine', 'karma-typescript', 'mock-server'],
    files: ['src/**/*.ts', 'fixtures/**/*.ts', 'fixtures/**/*.js'],
    exclude: [
      'src/__tests__/utils/envoyProxy.ts',
      'src/__tests__/utils/grpcwebproxy.ts',
      'src/__tests__/utils/browserstack-local.ts',
      'src/__tests__/utils/mockServer/server.ts',
    ],
    preprocessors: {
      '**/*.ts': 'karma-typescript',
      '**/*.js': 'karma-typescript',
    },
    reporters: ['spec', 'karma-typescript'],
    browsers: ['CustomWebdriverIO'],
    customLaunchers: {
      CustomWebdriverIO: {
        base: 'WebdriverIO',
        options: {
          ...(config.browserstack
            ? {
                hostname: 'hub.browserstack.com',
                user: process.env.BROWSERSTACK_USERNAME,
                key: process.env.BROWSERSTACK_KEY,
              }
            : {}),
          capabilities: {
            acceptInsecureCerts: true,
            'goog:chromeOptions': {
              args: ['--ignore-certificate-errors'],
            },
            browserName: process.env.BROWSER_NAME ?? 'Chrome',
            'bstack:options': {
              local: true,
              localIdentifier: randomUUID(),
              idleTimeout: 300,
              networkLogs: true,
              browserVersion: process.env.BROWSERSTACK_BROWSER_VERSION,
              os: process.env.BROWSERSTACK_OS,
              osVersion: process.env.BROWSERSTACK_OS_VERSION,
              realMobile: false,
            },
          },
          maxInstances: 1,
        },
      },
    },

    client: {
      jasmine: {
        timeoutInterval: 15_000,
      },
    },

    loggers: [{type: 'console', pattern: '%d{HH:mm:ss} %m'}],

    plugins: [
      'karma-*',
      {
        'framework:mock-server': [
          'factory',
          function (args, config, logger) {
            startMockServer(logger.create('framework.mock-server'));
          },
        ],
        'launcher:WebdriverIO': ['type', WebdriverIOLauncher],
      },
    ],

    karmaTypescriptConfig: {
      tsconfig: 'tsconfig.json',
      bundlerOptions: {
        constants: {
          'process.env': {
            FORCE_ALL_TESTS: process.env.FORCE_ALL_TESTS,
          },
        },
        acornOptions: {
          ecmaVersion: 11,
        },
        transforms: [require('karma-typescript-es6-transform')()],
      },
    },
  });
};

WebdriverIOLauncher.$inject = ['baseBrowserDecorator', 'args'];
function WebdriverIOLauncher(
  this: {
    on(event: 'kill', listener: (done: () => void) => void): void;
    _done(error: unknown): void;
  },
  baseBrowserDecorator: (arg: any) => void,
  {options}: CustomLauncher,
) {
  if (options == null) {
    throw new Error('Launcher options must be provided');
  }

  baseBrowserDecorator(this);

  Object.assign(this, {
    name: 'WebdriverIO',
    _start: (url: string) => {
      Promise.resolve().then(async () => {
        const browserstackLocal = options.key
          ? await startBrowserstackLocal(
              options.key,
              (options.capabilities as any)['bstack:options']?.localIdentifier,
            )
          : null;

        try {
          const browser = await wdio.remote(options);

          this.on('kill', (done: () => void) => {
            browser.deleteSession().finally(() => {
              browserstackLocal?.stop();
              done();
            });
          });

          await browser.url(url);
        } catch (err) {
          browserstackLocal?.stop();

          this._done(err);
        }
      });
    },
  });
}
