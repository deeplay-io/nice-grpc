import {
  Channel,
  ChannelCredentials,
  ChannelOptions,
  connectivityState,
} from '@grpc/grpc-js';

const knownProtocols = new Set(["http", "https"]);

export function createChannel(
  address: string,
  credentials?: ChannelCredentials,
  options: ChannelOptions = {},
): Channel {
  const match = /^(?:([^:]+):\/\/)?(.*?)(?::(\d+))?$/.exec(address);
  if (match == null) throw new Error(`Invalid address: '${address}'`);

  let [, protocol, host, port] = match;

  const knownProtocol = !protocol || knownProtocols.has(protocol);
  const isSecure = credentials?._isSecure() || protocol?.includes("https");

  credentials ??= isSecure ? ChannelCredentials.createSsl() : ChannelCredentials.createInsecure();
  port ??= isSecure ? '443' : '80';

  let target = knownProtocol ? `${host}:${port}` : address;
  return new Channel(target, credentials, options);
}

export async function waitForChannelReady(
  channel: Channel,
  deadline: Date,
): Promise<void> {
  while (true) {
    const state = channel.getConnectivityState(true);

    if (state === connectivityState.READY) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      channel.watchConnectivityState(state, deadline, err => {
        if (err != null) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
