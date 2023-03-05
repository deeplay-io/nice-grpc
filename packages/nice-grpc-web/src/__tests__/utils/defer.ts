export type Deferred<T> = {
  promise: Promise<T>;
  resolve(value?: T): void;
  reject(error: unknown): void;
};

export function defer<T = void>(timeoutMs = 10_000): Deferred<T> {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;

  const promise = new Promise<T>((resolve_, reject_) => {
    const timeout = setTimeout(() => {
      reject_(new Error('Deferred timed out'));
    }, timeoutMs);

    resolve = value => {
      resolve_(value);
      clearTimeout(timeout);
    };

    reject = error => {
      reject_(error);
      clearTimeout(timeout);
    };
  });

  promise.catch(() => {}); // prevent unhandled rejection

  return {promise, resolve: resolve!, reject: reject!};
}
