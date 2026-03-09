// Provide a minimal window global for tests that spy on window.postMessage
(globalThis as any).window = {
  postMessage: () => ({}),
};
