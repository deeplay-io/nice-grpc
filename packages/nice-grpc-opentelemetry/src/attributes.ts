import {Attributes} from '@opentelemetry/api';
import {
  SEMATTRS_RPC_SYSTEM,
  SEMATTRS_RPC_SERVICE,
  SEMATTRS_RPC_METHOD,
  SEMATTRS_RPC_GRPC_STATUS_CODE,
  SEMATTRS_NET_PEER_NAME,
  SEMATTRS_NET_PEER_IP,
  SEMATTRS_NET_PEER_PORT,
} from '@opentelemetry/semantic-conventions';
import * as ipaddr from 'ipaddr.js';
import {Status} from 'nice-grpc-common';

/**
 * @param methodPath Full method path in form `/package.service/method`
 *
 * @see https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/#common-attributes
 */
export function getMethodAttributes(methodPath: string): Attributes {
  const [, service, method] = methodPath.split('/');

  return {
    [SEMATTRS_RPC_SYSTEM]: 'grpc',
    [SEMATTRS_RPC_SERVICE]: service,
    [SEMATTRS_RPC_METHOD]: method,
  };
}

/**
 * @see https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/#grpc-attributes
 */
export function getStatusAttributes(status: Status): Attributes {
  return {
    [SEMATTRS_RPC_GRPC_STATUS_CODE]: status,
    'rpc.grpc.status_text': Status[status],
  };
}

/**
 * @param peer Peer provided by `grpc-js`, usually `ip:port`
 *
 * @see https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/#common-attributes
 */
export function getPeerAttributes(peer: string): Attributes {
  const lastColonIndex = peer.lastIndexOf(':');

  if (lastColonIndex === -1) {
    return {
      [SEMATTRS_NET_PEER_NAME]: peer,
    };
  }

  const host = peer.slice(0, lastColonIndex);
  const port = +peer.slice(lastColonIndex + 1);

  if (Number.isNaN(port)) {
    return {
      [SEMATTRS_NET_PEER_NAME]: peer,
    };
  }

  if (ipaddr.isValid(host)) {
    return {
      [SEMATTRS_NET_PEER_IP]: host,
      [SEMATTRS_NET_PEER_PORT]: port,
    };
  }

  return {
    [SEMATTRS_NET_PEER_NAME]: host,
    [SEMATTRS_NET_PEER_PORT]: port,
  };
}
