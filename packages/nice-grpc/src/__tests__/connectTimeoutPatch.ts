import {test, expect} from 'vitest';
import {applyConnectTimeoutPatch} from '../client/connectTimeoutPatch';

/**
 * The patch is applied as a side effect of importing the library, so failing to
 * apply it must never throw, and applying it twice must not stack wrappers.
 */

test('is applied to the current grpc-js', () => {
  expect(applyConnectTimeoutPatch()).toBe(true);
});

test('is idempotent', () => {
  applyConnectTimeoutPatch();

  const transport = require('@grpc/grpc-js/build/src/transport');
  const connect = transport.Http2SubchannelConnector.prototype.connect;
  const tcpConnect = transport.Http2SubchannelConnector.prototype.tcpConnect;

  expect(applyConnectTimeoutPatch()).toBe(true);

  expect(transport.Http2SubchannelConnector.prototype.connect).toBe(connect);
  expect(transport.Http2SubchannelConnector.prototype.tcpConnect).toBe(
    tcpConnect,
  );
});

test('does nothing when grpc-js internals are missing', () => {
  const path = require.resolve('@grpc/grpc-js/build/src/transport');
  const original = require.cache[path];

  require.cache[path] = {
    id: path,
    filename: path,
    loaded: true,
    exports: {SomeRenamedConnector: class {}},
  } as NodeJS.Module;

  try {
    expect(applyConnectTimeoutPatch()).toBe(false);
  } finally {
    require.cache[path] = original;
  }
});
