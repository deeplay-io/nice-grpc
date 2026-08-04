import * as net from 'net';
import {test, expect} from 'vitest';
import {Channel, ChannelOptions, connectivityState} from '@grpc/grpc-js';
import {createChannel, createClient} from '..';
import {TestDefinition} from '../../fixtures/ts-proto/test';
import {defer} from './utils/defer';

/**
 * Shortened connection attempt timeout, so that the tests don't have to wait
 * for the full `MIN_CONNECT_TIMEOUT` of 20 seconds.
 */
const connectTimeoutMs = 3000;

/** Generous multiple of `connectTimeoutMs` to wait for the expected outcome. */
const waitMs = 10_000;

const channelOptions: ChannelOptions = {
  'grpc-node.connect_timeout_ms': connectTimeoutMs,
  // Keep backoff short, so that a retry, if any, happens within the test.
  'grpc.initial_reconnect_backoff_ms': 100,
  'grpc.max_reconnect_backoff_ms': 100,
};

/**
 * Starts a TCP server that accepts connections but never sends anything,
 * emulating a network path that is established at the TCP level but silently
 * drops all data (a broken middlebox flow, a half-open path left after a NAT
 * conntrack entry is dropped etc.).
 *
 * From the client's point of view the TCP handshake succeeds, but the server's
 * HTTP/2 SETTINGS frame never arrives.
 */
async function startSilentServer() {
  const sockets = new Set<net.Socket>();
  let connectionCount = 0;

  const server = net.createServer(socket => {
    connectionCount += 1;
    sockets.add(socket);
    socket.on('data', () => {});
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });

  const listening = defer<void>();
  server.listen(0, '127.0.0.1', () => listening.resolve());
  await listening;

  return {
    port: (server.address() as net.AddressInfo).port,
    /** Total number of connections accepted. */
    get connectionCount() {
      return connectionCount;
    },
    /** Number of connections that are still open. */
    get openConnectionCount() {
      return sockets.size;
    },
    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }

      const closed = defer<void>();
      server.close(() => closed.resolve());
      await closed;
    },
  };
}

function watchStateChange(
  channel: Channel,
  state: connectivityState,
  timeoutMs: number,
): Promise<boolean> {
  const changed = defer<boolean>();

  channel.watchConnectivityState(state, Date.now() + timeoutMs, err => {
    changed.resolve(err == null);
  });

  return changed;
}

/**
 * A connection attempt that completes at the TCP level but never receives the
 * server's HTTP/2 SETTINGS frame must not hang forever.
 *
 * The gRPC connection backoff spec requires a connection attempt to be given at
 * most `MIN_CONNECT_TIMEOUT` (20 seconds), after which it fails and the
 * subchannel goes to TRANSIENT_FAILURE, from where backoff retries it:
 * https://github.com/grpc/grpc/blob/master/doc/connection-backoff.md
 *
 * grpc-js has no such timeout: `Http2SubchannelConnector.createSession` awaits
 * the `remoteSettings` event with no timer, so the returned promise never
 * settles and the subchannel stays in CONNECTING indefinitely. Since backoff is
 * only armed when a connection attempt *fails*, no retry is ever scheduled and
 * the channel stays dead until it is recreated.
 *
 * https://github.com/grpc/grpc-node/issues/2785
 */
test('connection attempt to a silent path times out', async () => {
  const server = await startSilentServer();

  const channel = createChannel(`127.0.0.1:${server.port}`, undefined, {
    ...channelOptions,
    // Keepalive does not help here: it only applies to an established
    // transport, and no transport is ever established.
    'grpc.keepalive_time_ms': 1000,
    'grpc.keepalive_timeout_ms': 1000,
  });

  try {
    // Trigger connecting. The transition out of IDLE is asynchronous.
    expect(channel.getConnectivityState(true)).toBe(connectivityState.IDLE);
    expect(await watchStateChange(channel, connectivityState.IDLE, 1000)).toBe(
      true,
    );
    expect(channel.getConnectivityState(false)).toBe(
      connectivityState.CONNECTING,
    );

    const leftConnecting = await watchStateChange(
      channel,
      connectivityState.CONNECTING,
      waitMs,
    );

    expect(
      leftConnecting,
      'channel stayed in CONNECTING: the connection attempt never timed out',
    ).toBe(true);
  } finally {
    channel.close();
    await server.close();
  }
});

/**
 * A call made over a channel whose connection attempt is hanging must fail
 * rather than block forever, even when no deadline is set.
 */
test('call over a silent path fails instead of hanging', async () => {
  const server = await startSilentServer();

  const channel = createChannel(
    `127.0.0.1:${server.port}`,
    undefined,
    channelOptions,
  );
  const client = createClient(TestDefinition, channel);

  const timedOut = Symbol('timedOut');

  try {
    // No deadline: the call may only fail because the connection attempt
    // failed, not because a deadline passed.
    const result = await Promise.race([
      client.testUnary({id: 'test'}).then(
        () => 'resolved',
        (err: unknown) => err,
      ),
      new Promise<typeof timedOut>(resolve =>
        setTimeout(() => resolve(timedOut), waitMs).unref(),
      ),
    ]);

    expect(
      result,
      'the call neither failed nor completed: it hung on a dead channel',
    ).not.toBe(timedOut);
    expect(result).toMatchObject({
      message: expect.stringMatching(/UNAVAILABLE/),
    });
  } finally {
    channel.close();
    await server.close();
  }
});

/**
 * A timed out connection attempt must be torn down. Otherwise every retry
 * leaves behind an established socket that the client will never use, and a
 * channel reconnecting in a loop leaks a socket per attempt.
 */
test('timed out connection attempts do not leak sockets', async () => {
  const server = await startSilentServer();

  const channel = createChannel(`127.0.0.1:${server.port}`, undefined, {
    ...channelOptions,
    'grpc-node.connect_timeout_ms': 500,
  });

  try {
    channel.getConnectivityState(true);

    // Let the channel go through several connection attempts.
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      // Nudge the channel out of TRANSIENT_FAILURE / IDLE to keep it retrying.
      channel.getConnectivityState(true);
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    expect(server.connectionCount).toBeGreaterThan(2);
    // At most the currently pending attempt may be open.
    expect(server.openConnectionCount).toBeLessThanOrEqual(1);
  } finally {
    channel.close();
    await server.close();
  }
});
