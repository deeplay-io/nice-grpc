import {encodeFrame} from './framing';

export type EncodeRequestParams<T> = {
  request: AsyncIterable<T>;
  encode(data: T): Uint8Array;
};

export async function* encodeRequest<T>({
  request,
  encode,
}: EncodeRequestParams<T>): AsyncIterable<Uint8Array> {
  for await (const data of request) {
    const bytes = encode(data);

    yield encodeFrame(bytes);
  }
}
