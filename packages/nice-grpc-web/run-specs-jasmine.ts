import * as path from 'path';
import * as fs from 'fs';
import * as selfsigned from 'selfsigned';
import Jasmine from 'jasmine';
import {SpecReporter} from 'jasmine-spec-reporter';

import {MockServerLogger, startMockServer} from './test-server/server';

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

const certPath = path.resolve(__dirname, './test-server/cert/self-signed.crt');
const keyPath = path.resolve(__dirname, './test-server/cert/self-signed.key');

const hostname = '127.0.0.1';
const cert = selfsigned.generate([{name: 'commonName', value: hostname}], {
  keySize: 2048,
});

fs.writeFileSync(certPath, cert.cert);
fs.writeFileSync(keyPath, cert.private);

process.on('beforeExit', () => {
  fs.unlinkSync(certPath);
  fs.unlinkSync(keyPath);
});

const server = startMockServer(createLogger(LogLevel.info), certPath, keyPath);

jasmine.execute().finally(() => {
  server.close();
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
