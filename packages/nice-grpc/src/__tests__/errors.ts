import {status} from '@grpc/grpc-js';
import {ClientError} from '../client/ClientError';
import {ServerError} from '../server/ServerError';

test('server error instanceof', () => {
  class ServerErrorFromDifferentVersion extends Error {
    constructor(public code: status, public details: string) {
      super(`${status[code]}: ${details}`);

      this.name = 'ServerError';
      Object.defineProperty(this, '@@nice-grpc', {
        value: true,
      });

      Error.captureStackTrace(this, this.constructor);
    }

    static [Symbol.hasInstance](instance: unknown) {
      return (
        typeof instance === 'object' &&
        instance !== null &&
        (instance as any).name === 'ServerError' &&
        (instance as any)['@@nice-grpc'] === true
      );
    }
  }

  expect(
    new ServerErrorFromDifferentVersion(status.UNKNOWN, '') instanceof
      ServerError,
  ).toBe(true);
});

test('client error instanceof', () => {
  class ClientErrorFromDifferentVersion extends Error {
    constructor(
      public path: string,
      public code: status,
      public details: string,
    ) {
      super(`${status[code]}: ${details}`);

      this.name = 'ClientError';
      Object.defineProperty(this, '@@nice-grpc', {
        value: true,
      });

      Error.captureStackTrace(this, this.constructor);
    }

    static [Symbol.hasInstance](instance: unknown) {
      return (
        typeof instance === 'object' &&
        instance !== null &&
        (instance as any).name === 'ClientError' &&
        (instance as any)['@@nice-grpc'] === true
      );
    }
  }

  expect(
    new ClientErrorFromDifferentVersion('', status.UNKNOWN, '') instanceof
      ClientError,
  ).toBe(true);
});
