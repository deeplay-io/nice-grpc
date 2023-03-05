/** @internal */
export async function* asyncIterableOf<T>(item: T): AsyncIterable<T> {
  yield item;
}
