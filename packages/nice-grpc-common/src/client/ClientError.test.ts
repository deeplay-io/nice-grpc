import ExtendableError from 'ts-error';
import {Status} from '../Status';
import {ClientError} from './ClientError';

test('instanceof', () => {
  expect(new ClientError('', Status.UNKNOWN, '')).toBeInstanceOf(ClientError);
});

test.each([
  class ClientError extends Error {
    constructor(
      public path: string,
      public code: Status,
      public details: string,
    ) {
      super(`${Status[code]}: ${details}`);

      this.name = 'ClientError';
      Object.defineProperty(this, '@@nice-grpc', {
        value: true,
      });

      Error.captureStackTrace(this, this.constructor);
    }

    static [Symbol.hasInstance](instance: any) {
      return (
        typeof instance === 'object' &&
        instance !== null &&
        instance.name === 'ClientError' &&
        instance['@@nice-grpc'] === true
      );
    }
  },
  class ClientError extends ExtendableError {
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

    static [Symbol.hasInstance](instance: any) {
      // allow instances of ClientError from different versions of nice-grpc
      // to work with `instanceof ClientError`
      return (
        typeof instance === 'object' &&
        instance !== null &&
        (instance.constructor === ClientError ||
          (instance.name === 'ClientError' && instance['@@nice-grpc'] === true))
      );
    }
  },
  class ClientError extends ExtendableError {
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
      Object.defineProperty(this, '@@nice-grpc:ClientError', {
        value: true,
      });
    }

    static [Symbol.hasInstance](instance: any) {
      // allow instances of ClientError from different versions of nice-grpc
      // to work with `instanceof ClientError`

      if (this !== ClientError) {
        return this.prototype.isPrototypeOf(instance);
      }

      return (
        typeof instance === 'object' &&
        instance !== null &&
        (instance.constructor === ClientError ||
          instance['@@nice-grpc:ClientError'] === true ||
          (instance.name === 'ClientError' && instance['@@nice-grpc'] === true))
      );
    }
  },
])('instanceof with previous versions: %#', ClientErrorFromDifferentVersion => {
  expect(
    new ClientErrorFromDifferentVersion('', Status.UNKNOWN, '') instanceof
      ClientError,
  ).toBe(true);

  expect(
    new ClientError('', Status.UNKNOWN, '') instanceof
      ClientErrorFromDifferentVersion,
  ).toBe(true);
});

test('extend', () => {
  class ClientErrorExtended extends ClientError {}

  expect(new ClientErrorExtended('', Status.UNKNOWN, '')).toBeInstanceOf(
    ClientError,
  );

  expect(new ClientError('', Status.UNKNOWN, '')).not.toBeInstanceOf(
    ClientErrorExtended,
  );
});
