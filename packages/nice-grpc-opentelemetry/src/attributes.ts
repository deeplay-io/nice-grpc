import {Attributes} from '@opentelemetry/api';
import {SemanticAttributes} from '@opentelemetry/semantic-conventions';
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
    [SemanticAttributes.RPC_SYSTEM]: 'grpc',
    [SemanticAttributes.RPC_SERVICE]: service,
    [SemanticAttributes.RPC_METHOD]: method,
  };
}

/**
 * @see https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/rpc/#grpc-attributes
 */
export function getStatusAttributes(status: Status): Attributes {
  return {
    [SemanticAttributes.RPC_GRPC_STATUS_CODE]: status,
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
      [SemanticAttributes.NET_PEER_NAME]: peer,
    };
  }

  const host = peer.slice(0, lastColonIndex);
  const port = +peer.slice(lastColonIndex + 1);

  if (Number.isNaN(port)) {
    return {
      [SemanticAttributes.NET_PEER_NAME]: peer,
    };
  }

  if (ipaddr.isValid(host)) {
    return {
      [SemanticAttributes.NET_PEER_IP]: host,
      [SemanticAttributes.NET_PEER_PORT]: port,
    };
  }

  return {
    [SemanticAttributes.NET_PEER_NAME]: host,
    [SemanticAttributes.NET_PEER_PORT]: port,
  };
}
