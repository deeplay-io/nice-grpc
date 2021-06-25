import {Status} from '../Status';
import {ClientError} from './ClientError';

test('instanceof', () => {
  class ClientErrorFromDifferentVersion extends Error {
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
    new ClientErrorFromDifferentVersion('', Status.UNKNOWN, '') instanceof
      ClientError,
  ).toBe(true);
});
