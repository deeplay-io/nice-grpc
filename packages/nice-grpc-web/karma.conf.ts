import * as fs from 'fs';
import * as path from 'path';
import {Config, CustomLauncher} from 'karma';
import {KarmaTypescriptConfig} from 'karma-typescript';
import * as selfsigned from 'selfsigned';
import * as wdio from 'webdriverio';
import {randomUUID} from 'crypto';

import {startMockServer} from './test-server/server';
import {startBrowserstackLocal} from './test-server/browserstack-local';

declare module 'karma' {
  export interface ConfigOptions {
    karmaTypescriptConfig?: KarmaTypescriptConfig;
    babelPreprocessor?: {
      options: any;
    };
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

const BROWSERSTACK_USERNAME = process.env.BROWSERSTACK_USERNAME;
const BROWSERSTACK_KEY = process.env.BROWSERSTACK_KEY;
const BROWSER_NAME = process.env.BROWSER_NAME;
const BROWSERSTACK_BROWSER_VERSION = process.env.BROWSERSTACK_BROWSER_VERSION;
const BROWSERSTACK_OS = process.env.BROWSERSTACK_OS;
const BROWSERSTACK_OS_VERSION = process.env.BROWSERSTACK_OS_VERSION;
const FORCE_ALL_TESTS = process.env.FORCE_ALL_TESTS;

export default (config: Config & Record<string, unknown>) => {
  let hostname: string;
  let certPath: string;
  let keyPath: string;

  if (config.browserstack) {
    hostname = 'nice-grpc-web-tests.deeplay.io';
    certPath = path.resolve(__dirname, './test-server/cert/tls.crt');
    keyPath = path.resolve(__dirname, './test-server/cert/tls.key');
  } else {
    hostname = '127.0.0.1';
    certPath = path.resolve(__dirname, './test-server/cert/self-signed.crt');
    keyPath = path.resolve(__dirname, './test-server/cert/self-signed.key');

    const cert = selfsigned.generate([{name: 'commonName', value: hostname}], {
      keySize: 2048,
    });

    fs.writeFileSync(certPath, cert.cert);
    fs.writeFileSync(keyPath, cert.private);

    process.on('beforeExit', () => {
      fs.unlinkSync(certPath);
      fs.unlinkSync(keyPath);
    });
  }

  config.set({
    // logLevel: config.LOG_DEBUG,

    frameworks: ['jasmine', 'karma-typescript', 'mock-server'],
    files: [
      '../../node_modules/@babel/polyfill/dist/polyfill.js',
      'src/**/*.ts',
      'test-server/client.ts',
      'test-server/metadata.ts',
      'fixtures/**/*.ts',
      'fixtures/**/*.js',
    ],
    preprocessors: {
      '**/*.ts': 'karma-typescript',
      '**/*.js': 'karma-typescript',
      '../../node_modules/jasmine-core/lib/**/*.js': ['babel'],
    },
    reporters: ['spec', 'karma-typescript'],
    hostname,
    browsers: ['CustomWebdriverIO'],
    captureTimeout: 120000,
    browserNoActivityTimeout: 120000,
    customLaunchers: {
      CustomWebdriverIO: {
        base: 'WebdriverIO',
        options: {
          ...(config.browserstack
            ? {
                hostname: 'hub.browserstack.com',
                user: BROWSERSTACK_USERNAME,
                key: BROWSERSTACK_KEY,
              }
            : {}),
          capabilities: {
            browserName: BROWSER_NAME ?? 'chrome',
            acceptInsecureCerts: true,
            'goog:chromeOptions': {
              args: [
                '--allow-insecure-localhost',
                ...(config.headless
                  ? ['--headless', '--disable-gpu', '--disable-dev-shm-usage']
                  : []),
              ],
            },
            'bstack:options': {
              local: true,
              disableCorsRestrictions: true,
              localIdentifier: randomUUID(),
              idleTimeout: 300,
              // wsLocalSupport: true,
              // networkLogs: true,
              browserVersion: BROWSERSTACK_BROWSER_VERSION,
              os: BROWSERSTACK_OS,
              osVersion: BROWSERSTACK_OS_VERSION,
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
            startMockServer(
              logger.create('framework.mock-server'),
              certPath,
              keyPath,
            );
          },
        ],
        'launcher:WebdriverIO': ['type', WebdriverIOLauncher],
      },
    ],

    babelPreprocessor: {
      options: {
        presets: [['@babel/preset-env', {modules: false}]],
      },
    },

    karmaTypescriptConfig: {
      tsconfig: 'tsconfig.json',
      compilerOptions: {
        target: 'ES2018',
        lib: ['ES2018', 'DOM', 'DOM.Iterable'],
      },
      bundlerOptions: {
        constants: {
          'process.env': {
            FORCE_ALL_TESTS,
          },
        },
        transforms: [
          require('karma-typescript-es6-transform')({
            presets: [['@babel/preset-env']],
          }),
        ],
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
            Promise.resolve()
              .then(async () => {
                const browserLogs = await browser.getLogs('browser');
                console.log(
                  'browser logs:\n' +
                    (
                      browserLogs as Array<{
                        level: string;
                        message: string;
                        source: string;
                        timestamp: number;
                      }>
                    )
                      .map(
                        log =>
                          `${new Date(log.timestamp).toISOString()} ${
                            log.level
                          } [${log.source}] ${log.message}`,
                      )
                      .join('\n'),
                );
                await browser.deleteSession();
                browserstackLocal?.stop();
              })
              .finally(() => {
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
