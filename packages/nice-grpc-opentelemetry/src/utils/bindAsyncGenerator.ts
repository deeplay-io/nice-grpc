import {context, Context} from '@opentelemetry/api';

export function bindAsyncGenerator<T = unknown, TReturn = any, TNext = unknown>(
  ctx: Context,
  generator: AsyncGenerator<T, TReturn, TNext>,
): AsyncGenerator<T, TReturn, TNext> {
  return {
    next: context.bind(ctx, generator.next.bind(generator)),
    return: context.bind(ctx, generator.return.bind(generator)),
    throw: context.bind(ctx, generator.throw.bind(generator)),

    [Symbol.asyncIterator]() {
      return bindAsyncGenerator(ctx, generator[Symbol.asyncIterator]());
    },
  };
}
