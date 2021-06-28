import {ServerError} from 'nice-grpc';
import {Status} from '../..';

export function throwUnimplemented(): never {
  throw new ServerError(Status.UNIMPLEMENTED, '');
}
