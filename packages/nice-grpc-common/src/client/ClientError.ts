import {ExtendableError} from 'ts-error';
import {Status} from '../Status';

/**
 * Represents gRPC errors returned from client calls.
 */
export class ClientError extends ExtendableError {
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

    this.path = path;
    this.code = code;
    this.details = details;

    this.name = 'ClientError';
    Object.defineProperty(this, '@@nice-grpc', {
      value: true,
    });
  }

  static [Symbol.hasInstance](instance: unknown) {
    // allow instances of ClientError from different versions of nice-grpc
    // to work with `instanceof ClientError`
    return (
      typeof instance === 'object' &&
      instance !== null &&
      (instance.constructor === ClientError ||
        ((instance as any).name === 'ClientError' &&
          (instance as any)['@@nice-grpc'] === true))
    );
  }
}
