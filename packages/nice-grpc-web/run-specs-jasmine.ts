import Jasmine from 'jasmine';
import {SpecReporter} from 'jasmine-spec-reporter';
import * as selfsigned from 'selfsigned';
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';

import {
  MockServerLogger,
  startMockServer,
} from './src/__tests__/utils/mockServer/server';

// for Node16
global.ReadableStream ??= require('stream/web').ReadableStream;

const jasmine = new Jasmine();

Object.assign(jasmine.jasmine, {DEFAULT_TIMEOUT_INTERVAL: 15_000});

jasmine.loadConfig({
  spec_files: [
    'src/__tests__/**/*.ts',
    '!src/__tests__/utils/**/*.ts',
    'src/**/*.test.ts',
  ],

  stopOnSpecFailure: false,
  stopSpecOnExpectationFailure: true,
});

jasmine.addReporter(new SpecReporter());

const certs = selfsigned.generate([{name: 'commonName', value: 'localhost'}], {
  keySize: 2048,
});

const tmpDir = tmp.dirSync();

process.on('beforeExit', () => {
  tmpDir.removeCallback();
});

const certPath = path.join(tmpDir.name, 'tls.crt');
fs.writeFileSync(certPath, certs.cert);
const keyPath = path.join(tmpDir.name, 'tls.key');
fs.writeFileSync(keyPath, certs.private);

const stopMockServer = startMockServer(
  createLogger(LogLevel.info),
  certPath,
  keyPath,
);

jasmine.execute().finally(() => {
  stopMockServer();
});

const enum LogLevel {
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
}

function createLogger(logLevel: LogLevel): MockServerLogger {
  return {
    debug(message: any, ...args: any[]): void {
      if (logLevel <= LogLevel.debug) console.log(message, ...args);
    },
    info(message: any, ...args: any[]): void {
      if (logLevel <= LogLevel.info) console.log(message, ...args);
    },
    warn(message: any, ...args: any[]): void {
      if (logLevel <= LogLevel.warn) console.log(message, ...args);
    },
    error(message: any, ...args: any[]): void {
      if (logLevel <= LogLevel.error) console.log(message, ...args);
    },
  };
}
