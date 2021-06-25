import {Status} from '../Status';
import {ServerError} from './ServerError';

test('instanceof', () => {
  class ServerErrorFromDifferentVersion extends Error {
    constructor(
      public code: Status,
      public details: string,
    ) {
      super(`${Status[code]}: ${details}`);

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
    new ServerErrorFromDifferentVersion(Status.UNKNOWN, '') instanceof
      ServerError,
  ).toBe(true);
});
