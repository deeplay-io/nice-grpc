import {status} from '@grpc/grpc-js';

export class ServerError extends Error {
  constructor(public code: status, public details: string) {
    super(`${status[code]}: ${details}`);

    this.name = 'ServerError';
    Object.defineProperty(this, '@@nice-grpc', {
      value: true,
    });

    Error.captureStackTrace(this, this.constructor);
  }

  static [Symbol.hasInstance](instance: unknown) {
    // allow instances of ServerError from different versions of nice-grpc
    // to work with `instanceof ServerError`
    return (
      typeof instance === 'object' &&
      instance !== null &&
      (instance as any).name === 'ServerError' &&
      (instance as any)['@@nice-grpc'] === true
    );
  }
}
