export type CompatAbortSignal = AbortSignal & {
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
};
