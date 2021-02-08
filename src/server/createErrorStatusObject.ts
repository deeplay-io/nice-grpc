import {Metadata, status, StatusObject} from '@grpc/grpc-js';
import {ServerError} from './ServerError';

/** @internal */
export function createErrorStatusObject(
  error: unknown,
  trailer: Metadata,
): StatusObject {
  if (error instanceof ServerError) {
    return {
      code: error.code,
      details: error.details,
      metadata: trailer,
    };
  } else {
    // TODO: warning
    return {
      code: status.UNKNOWN,
      details: 'Unknown server error occurred',
      metadata: trailer,
    };
  }
}
