import {Metadata, status, StatusObject} from '@grpc/grpc-js';

export class ClientError extends Error {
  constructor(
    public path: string,
    public code: status,
    public details: string,
  ) {
    super(`${path} ${status[code]}: ${details}`);

    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
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
