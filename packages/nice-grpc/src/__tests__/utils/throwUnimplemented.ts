import {status} from '@grpc/grpc-js';
import {ServerError} from '../../server/ServerError';

export function throwUnimplemented(): never {
  throw new ServerError(status.UNIMPLEMENTED, '');
}
