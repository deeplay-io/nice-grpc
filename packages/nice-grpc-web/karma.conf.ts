import * as http2 from 'http2';
import proxy from 'http2-proxy';
import {Config, CustomLauncher} from 'karma';
import {KarmaTypescriptConfig} from 'karma-typescript';
import ngrok from 'ngrok';
import * as selfsigned from 'selfsigned';
import * as wdio from 'webdriverio';

import {startMockServer} from './src/__tests__/utils/mockServer/server';

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

const proxies = {
  '/mock-server': 18283,
  '/nice_grpc.test.Test': 48080,
};

const BROWSERSTACK_USERNAME = process.env.BROWSERSTACK_USERNAME;
const BROWSERSTACK_KEY = process.env.BROWSERSTACK_KEY;
const BROWSER_NAME = process.env.BROWSER_NAME;
const BROWSERSTACK_BROWSER_VERSION = process.env.BROWSERSTACK_BROWSER_VERSION;
const BROWSERSTACK_OS = process.env.BROWSERSTACK_OS;
const BROWSERSTACK_OS_VERSION = process.env.BROWSERSTACK_OS_VERSION;
const FORCE_ALL_TESTS = process.env.FORCE_ALL_TESTS;
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN;

export default (config: Config & Record<string, unknown>) => {
  const hostname = 'localhost';

  const certs = selfsigned.generate([{name: 'commonName', value: hostname}], {
    keySize: 2048,
  });

  config.set({
    // logLevel: config.LOG_DEBUG,

    frameworks: [
      'jasmine',
      'karma-typescript',
      'mock-server',
      'websocket-proxy',
    ],
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
    protocol: 'https:',
    httpModule: {
      createServer(options: http2.SecureServerOptions, handler: any) {
        return http2.createSecureServer(
          {
            ...options,
            key: certs.private,
            cert: certs.cert,
            allowHTTP1: true,
          },
          handler,
        );
      },
    } as any,
    hostname,
    beforeMiddleware: ['proxy'],
    browsers: ['CustomWebdriverIO'],
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
            'bstack:options': {
              idleTimeout: 300,
              networkLogs: true,
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
            startMockServer(logger.create('framework.mock-server'), {
              port: 18283,
            });
          },
        ],
        'launcher:WebdriverIO': ['type', WebdriverIOLauncher],
        'middleware:proxy': ['factory', ProxyMiddleware],
        'framework:websocket-proxy': ['factory', WebsocketProxy],
      },
    ],

    karmaTypescriptConfig: {
      tsconfig: 'tsconfig.json',
      bundlerOptions: {
        constants: {
          'process.env': {
            FORCE_ALL_TESTS,
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

function getProxyDestinationPort(req: http2.Http2ServerRequest) {
  for (const [path, port] of Object.entries(proxies)) {
    if (req.url.startsWith(path)) {
      return port;
    }
  }

  return null;
}

WebsocketProxy.$inject = ['webServer'];
function WebsocketProxy(server: http2.Http2Server) {
  server.on('upgrade', (req: http2.Http2ServerRequest, socket, head) => {
    const port = getProxyDestinationPort(req);

    if (port != null) {
      proxy.ws(req, socket, head, {
        hostname: 'localhost',
        port,
      });
    }
  });
}

function ProxyMiddleware() {
  return (
    req: http2.Http2ServerRequest,
    res: http2.Http2ServerResponse,
    next: (err?: unknown) => void,
  ): void => {
    const port = getProxyDestinationPort(req);

    if (port != null) {
      proxy.web(
        req,
        res,
        {
          hostname: 'localhost',
          port,
        },
        err => {
          if (err) {
            next(err);
          }
        },
      );
    } else {
      next();
    }
  };
}

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
        const parsedUrl = new URL(url);

        await ngrok.kill();
        const proxiedAddress = await retry(() =>
          ngrok.connect({
            addr: parsedUrl.origin,
            authtoken: NGROK_AUTHTOKEN,
          }),
        );

        const parsedProxiedUrl = new URL(proxiedAddress);
        parsedProxiedUrl.pathname = parsedUrl.pathname;
        parsedProxiedUrl.search = parsedUrl.search;
        const proxiedUrl = parsedProxiedUrl.toString();

        try {
          const browser = await wdio.remote(options);

          this.on('kill', (done: () => void) => {
            Promise.resolve()
              .then(async () => {
                await browser.deleteSession();
                await ngrok.disconnect(proxiedAddress);
              })
              .finally(() => {
                done();
              });
          });

          await browser.url(proxiedUrl);

          // confirm on ngrok page
          const button = await browser.$('button');
          await button.click();
        } catch (err) {
          await ngrok.disconnect(proxiedAddress);

          this._done(err);
        }
      });
    },
  });
}

async function retry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt++ >= retries) {
        throw err;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
