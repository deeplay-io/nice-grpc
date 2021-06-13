/**
 * Used to remove index signature from types.
 *
 * See https://stackoverflow.com/questions/51465182/typescript-remove-index-signature-using-mapped-types
 */
export type KnownKeys<T> = keyof {
  [ P in keyof T as string extends P ? never : number extends P ? never : P ] : T[P]
} & keyof T;