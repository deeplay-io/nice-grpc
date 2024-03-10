import * as path from 'path';
import * as fs from 'fs';
import * as selfsigned from 'selfsigned';
import Mocha from 'mocha';
import * as glob from 'glob';
import expect from 'expect';

import {startMockServer} from './test-server/server';

// for Node16
global.ReadableStream ??= require('stream/web').ReadableStream;

Object.assign(global, {expect});

const mocha = new Mocha({
  ui: 'bdd',
  timeout: 90_000,
  reporter: 'spec',
});

const files = glob.sync(['src/__tests__/**/*.ts', 'src/**/*.test.ts'], {
  ignore: ['src/__tests__/utils/**/*.ts'],
});

for (const file of files) {
  mocha.addFile(file);
}

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

const server = startMockServer({
  certPath,
  keyPath,
  enableDebugLogs: false,
});

mocha.run(failures => {
  server.close();

  process.exitCode = failures ? 1 : 0;
});
