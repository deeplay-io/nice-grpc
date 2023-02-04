/** @internal */
export function makeInternalErrorMessage(err: any): string {
  if (err == null || typeof err !== 'object') {
    return String(err);
  } else if (typeof err.stack === 'string') {
    if (typeof err.message === 'string') {
      if (err.stack.startsWith(err.message)) {
        return err.stack;
      } else {
        return err.message + '\n' + err.stack;
      }
    }

    return err.stack;
  } else if (err.message) {
    return err.message;
  } else {
    return JSON.stringify(err);
  }
}
