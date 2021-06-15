import {Metadata, status, StatusObject} from '@grpc/grpc-js';

export class ClientError extends Error {
  constructor(
    public path: string,
    public code: status,
    public details: string,
  ) {
    super(`${path} ${status[code]}: ${details}`);

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

/** @internal */
export function wrapClientError(error: unknown, path: string) {
  if (isStatusObject(error)) {
    return new ClientError(path, error.code, error.details);
  }

  return error;
}

function isStatusObject(obj: any): obj is StatusObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.code === 'number' &&
    typeof obj.details === 'string' &&
    obj.metadata instanceof Metadata
  );
}
