import {ServerError, Status} from '../..';

export function throwUnimplemented(): never {
  throw new ServerError(Status.UNIMPLEMENTED, '');
}
