import {Transport} from './Transport';
import {FetchTransport} from './transports/fetch';

/**
 * A channel represents a remote endpoint that can be connected to.
 */
export type Channel = {
  address: string;
  transport: Transport;
};

/**
 * Creates a new channel.
 *
 * @param address The address of the server, in the form `protocol://host:port`,
 *     where `protocol` is one of `http` or `https`. If the port is not
 *     specified, it will be inferred from the protocol.
 * @param transport The transport to use for the channel. If not specified, the
 *     default transport based on `fetch` will be used. Other supported
 *     transports include `WebsocketTransport` (works only with `grpcwebproxy`)
 *     and `NodeHttpTransport` (works only in NodeJS).
 */
export function createChannel(
  address: string,
  transport: Transport = FetchTransport(),
): Channel {
  return {address, transport};
}
