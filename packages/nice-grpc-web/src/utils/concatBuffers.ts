/** @internal */
export function concatBuffers(
  buffers: Uint8Array[],
  totalLength: number,
): Uint8Array {
  if (buffers.length === 1) {
    return buffers[0];
  }

  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}
