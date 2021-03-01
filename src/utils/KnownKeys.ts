/**
 * Used to remove index signature from types.
 *
 * See https://stackoverflow.com/questions/51465182/typescript-remove-index-signature-using-mapped-types
 */
export type KnownKeys<T> = {
  [K in keyof T]: string extends K ? never : K;
} extends {[_ in keyof T]: infer U}
  ? U & string
  : never;
