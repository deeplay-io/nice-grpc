import {Transport} from './Transport';
import {FetchTransport} from './transports/fetch';

export type Channel = {
  address: string;
  transport: Transport;
};

export function createChannel(
  address: string,
  transport: Transport = FetchTransport(),
): Channel {
  return {address, transport};
}
