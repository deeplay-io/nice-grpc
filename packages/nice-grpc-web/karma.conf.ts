import {Config, CustomLauncher} from 'karma';
import * as wdio from 'webdriverio';
import {KarmaTypescriptConfig} from 'karma-typescript';
import {startMockServer} from './src/__tests__/utils/mockServer/server';

declare module 'karma' {
  export interface ConfigOptions {
    karmaTypescriptConfig?: KarmaTypescriptConfig;
  }
}

export default (config: Config) => {
  config.set({
    // logLevel: config.LOG_DEBUG,

    frameworks: ['jasmine', 'karma-typescript', 'mock-server'],
    files: ['src/**/*.ts', 'fixtures/**/*.ts', 'fixtures/**/*.js'],
    exclude: [
      'src/__tests__/utils/envoyProxy.ts',
      'src/__tests__/utils/grpcwebproxy.ts',
      'src/__tests__/utils/mockServer/server.ts',
    ],
    preprocessors: {
      '**/*.ts': 'karma-typescript',
      '**/*.js': 'karma-typescript',
    },
    reporters: ['spec', 'karma-typescript'],
    browsers: ['ChromeWebdriverIO'],
    customLaunchers: {
      ChromeWebdriverIO: {
        base: 'WebdriverIO',
        browserName: 'chrome',
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
  args: CustomLauncher,
) {
  baseBrowserDecorator(this);

  Object.assign(this, {
    name: 'WebdriverIO',
    _start: (url: string) => {
      wdio
        .remote({
          capabilities: {
            browserName: args.browserName,
            platformName: args.platform,
            acceptInsecureCerts: true,
            'goog:chromeOptions': {
              args: ['--ignore-certificate-errors'],
            },
          },
          maxInstances: 1,
        })
        .then(
          async browser => {
            this.on('kill', (done: () => void) => {
              browser.closeWindow().then(() => {
                done();
              });
            });

            await browser.url(url);
          },
          err => {
            this._done(err);
          },
        );
    },
  });
}
