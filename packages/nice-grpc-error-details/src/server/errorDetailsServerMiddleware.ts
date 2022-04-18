import {ServerMiddleware} from 'nice-grpc-common';
import {encodeErrorDetails} from '../ErrorDetails';
import {Status} from '../proto/google/rpc/status';
import {RichServerError} from './RichServerError';

export const errorDetailsServerMiddleware: ServerMiddleware =
  async function* errorDetailsServerMiddleware(call, context) {
    try {
      return yield* call.next(call.request, context);
    } catch (err) {
      if (err instanceof RichServerError) {
        const status = Status.fromPartial({
          code: err.code,
          message: err.details,
          details: encodeErrorDetails(err.extra),
        });

        context.trailer.set(
          'grpc-status-details-bin',
          Status.encode(status).finish(),
        );
      }

      throw err;
    }
  };
