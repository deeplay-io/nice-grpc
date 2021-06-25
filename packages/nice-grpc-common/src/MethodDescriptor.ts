/**
 * Method descriptor that is passed to middleware.
 */
export type MethodDescriptor = {
  /**
   * Full path of the method in form `/package.Service/Method`.
   */
  path: string;
  /**
   * Method options declared in Protobuf definition.
   */
  options: {
    idempotencyLevel?: 'IDEMPOTENT' | 'NO_SIDE_EFFECTS';
  };
};
