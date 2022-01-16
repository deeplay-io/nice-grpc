import {Status} from '../Status';

/**
 * Represents gRPC errors returned from client calls.
 */
export class ClientError extends Error {
  /**
   * Path of the client call.
   *
   * Has format `/package.Service/Method`.
   */
  path: string;
  /**
   * Status code reported by the server.
   */
  code: Status;
  /**
   * Status message reported by the server.
   */
  details: string;

  constructor(path: string, code: Status, details: string) {
    super(`${path} ${Status[code]}: ${details}`);

    Object.setPrototypeOf(this, ClientError.prototype);

    this.path = path;
    this.code = code;
    this.details = details;

    this.name = 'ClientError';
    Object.defineProperty(this, '@@nice-grpc', {
      value: true,
    });

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
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
