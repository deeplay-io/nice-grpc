import {grpc} from '@improbable-eng/grpc-web';

export type Channel = {
  address: string;
  transport?: grpc.TransportFactory;
};

export function createChannel(
  address: string,
  transport?: grpc.TransportFactory,
): Channel {
  return {address, transport};
}
