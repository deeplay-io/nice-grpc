import {ServerError, Status} from 'nice-grpc-common';

export function throwUnimplemented(): never {
  throw new ServerError(Status.UNIMPLEMENTED, '');
}
