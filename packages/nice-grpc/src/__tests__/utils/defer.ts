export interface Deferred<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  isResolved: boolean;
  isRejected: boolean;
  isSettled: boolean;
}

export function defer<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  const deferred = promise as Deferred<T>;
  deferred.resolve = resolve;
  deferred.reject = reject;
  deferred.isResolved = false;
  deferred.isRejected = false;
  deferred.isSettled = false;
  deferred.then(
    () => {
      deferred.isResolved = true;
      deferred.isSettled = true;
    },
    () => {
      deferred.isRejected = true;
      deferred.isSettled = true;
    },
  );

  return deferred;
}
