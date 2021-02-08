import {status} from '@grpc/grpc-js';

export class ServerError extends Error {
  constructor(public code: status, public details: string) {
    super(`${status[code]}: ${details}`);

    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}
