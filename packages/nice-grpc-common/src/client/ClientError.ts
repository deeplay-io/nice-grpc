import {Status} from '../Status';

export class ClientError extends Error {
  constructor(
    public path: string,
    public code: Status,
    public details: string,
  ) {
    super(`${path} ${Status[code]}: ${details}`);

    this.name = 'ClientError';
    Object.defineProperty(this, '@@nice-grpc', {
      value: true,
    });

    Error.captureStackTrace(this, this.constructor);
  }

  static [Symbol.hasInstance](instance: unknown) {
    // allow instances of ClientError from different versions of nice-grpc
    // to work with `instanceof ClientError`
    return (
      typeof instance === 'object' &&
      instance !== null &&
      (instance as any).name === 'ClientError' &&
      (instance as any)['@@nice-grpc'] === true
    );
  }
}
