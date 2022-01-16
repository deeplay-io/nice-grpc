import {Status} from '../Status';

/**
 * Service implementations may throw this error to report gRPC errors to
 * clients.
 */
export class ServerError extends Error {
  /**
   * Status code to report to the client.
   */
  code: Status;
  /**
   * Status message to report to the client.
   */
  details: string;

  constructor(code: Status, details: string) {
    super(`${Status[code]}: ${details}`);

    Object.setPrototypeOf(this, ServerError.prototype);

    this.code = code;
    this.details = details;

    this.name = 'ServerError';
    Object.defineProperty(this, '@@nice-grpc', {
      value: true,
    });

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
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
