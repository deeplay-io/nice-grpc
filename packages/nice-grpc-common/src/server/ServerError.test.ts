import ExtendableError from 'ts-error';
import {Status} from '../Status';
import {ServerError} from './ServerError';

test('instanceof', () => {
  expect(new ServerError(Status.UNKNOWN, '')).toBeInstanceOf(ServerError);
});

test.each([
  class ServerError extends Error {
    constructor(public code: Status, public details: string) {
      super(`${Status[code]}: ${details}`);

      this.name = 'ServerError';
      Object.defineProperty(this, '@@nice-grpc', {
        value: true,
      });

      Error.captureStackTrace(this, this.constructor);
    }

    static [Symbol.hasInstance](instance: any) {
      return (
        typeof instance === 'object' &&
        instance !== null &&
        instance.name === 'ServerError' &&
        instance['@@nice-grpc'] === true
      );
    }
  },
  class ServerError extends ExtendableError {
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

      this.code = code;
      this.details = details;

      this.name = 'ServerError';
      Object.defineProperty(this, '@@nice-grpc', {
        value: true,
      });
    }

    static [Symbol.hasInstance](instance: unknown) {
      // allow instances of ServerError from different versions of nice-grpc
      // to work with `instanceof ServerError`
      return (
        typeof instance === 'object' &&
        instance !== null &&
        (instance.constructor === ServerError ||
          ((instance as any).name === 'ServerError' &&
            (instance as any)['@@nice-grpc'] === true))
      );
    }
  },
  class ServerError extends ExtendableError {
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

      this.code = code;
      this.details = details;

      this.name = 'ServerError';
      Object.defineProperty(this, '@@nice-grpc', {
        value: true,
      });
      Object.defineProperty(this, '@@nice-grpc:ServerError', {
        value: true,
      });
    }

    static [Symbol.hasInstance](instance: any) {
      // allow instances of ServerError from different versions of nice-grpc
      // to work with `instanceof ServerError`

      if (this !== ServerError) {
        return this.prototype.isPrototypeOf(instance);
      }

      return (
        typeof instance === 'object' &&
        instance !== null &&
        (instance.constructor === ServerError ||
          instance['@@nice-grpc:ServerError'] === true ||
          (instance.name === 'ServerError' && instance['@@nice-grpc'] === true))
      );
    }
  },
])('instanceof with previous versions: %#', ServerErrorFromDifferentVersion => {
  expect(
    new ServerErrorFromDifferentVersion(Status.UNKNOWN, '') instanceof
      ServerError,
  ).toBe(true);

  expect(
    new ServerError(Status.UNKNOWN, '') instanceof
      ServerErrorFromDifferentVersion,
  ).toBe(true);
});

test('extend', () => {
  class ServerErrorExtended extends ServerError {}

  expect(new ServerErrorExtended(Status.UNKNOWN, '')).toBeInstanceOf(
    ServerError,
  );

  expect(new ServerError(Status.UNKNOWN, '')).not.toBeInstanceOf(
    ServerErrorExtended,
  );
});
