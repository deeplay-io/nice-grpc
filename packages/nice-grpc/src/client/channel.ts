import {Channel, ChannelCredentials, ChannelOptions} from '@grpc/grpc-js';
import {ConnectivityState} from '@grpc/grpc-js/build/src/channel';

export function createChannel(
  address: string,
  credentials?: ChannelCredentials,
  options: ChannelOptions = {},
): Channel {
  const match = /^(?:([^:]+):\/\/)?(.*?)(?::(\d+))?$/.exec(address);

  if (match == null) {
    throw new Error(`Invalid address: '${address}'`);
  }

  const [
    ,
    protocol = 'http',
    host,
    port = protocol === 'http' ? '80' : '443',
  ] = match;

  if (protocol === 'http') {
    credentials ??= ChannelCredentials.createInsecure();
  } else if (protocol === 'https') {
    credentials ??= ChannelCredentials.createSsl();
  } else {
    throw new Error(
      `Unsupported protocol: '${protocol}'. Expected one of 'http', 'https'`,
    );
  }

  return new Channel(`${host}:${port}`, credentials, options);
}

export async function waitForChannelReady(
  channel: Channel,
  deadline: Date,
): Promise<void> {
  while (true) {
    const state = channel.getConnectivityState(true);

    if (state === ConnectivityState.READY) {
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
