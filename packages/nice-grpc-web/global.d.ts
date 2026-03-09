import type {expect} from 'expect';

declare global {
  const expect: typeof import('expect')['expect'];
}
