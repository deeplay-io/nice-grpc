/** @internal */
export function makeInternalErrorMessage(err: any): string {
  if (err == null || typeof err !== 'object') {
    return String(err);
  } else if (typeof err.message === 'string') {
    return err.message;
  } else {
    return JSON.stringify(err);
  }
}
