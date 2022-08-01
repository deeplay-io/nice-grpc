import {
  Channel,
  ChannelCredentials,
  ChannelOptions,
  connectivityState,
} from '@grpc/grpc-js';

export function createChannel(
  address: string,
  credentials?: ChannelCredentials,
  options: ChannelOptions = {},
): Channel {
  const match = /^(?:([^:]+):\/\/)?(.*?)(?::(\d+))?$/.exec(address);

  if (match == null) {
    throw new Error(`Invalid address: '${address}'`);
  }

  const [, protocol = 'http', host, port = protocol === 'http' ? '80' : '443'] =
    match;

  if (protocol === 'http') {
    credentials ??= ChannelCredentials.createInsecure();
  } else if (protocol === 'https') {
    credentials ??= ChannelCredentials.createSsl();
  } else {
    credentials ??= ChannelCredentials.createInsecure();

    return new Channel(address, credentials, options);
  }

  return new Channel(`${host}:${port}`, credentials, options);
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
