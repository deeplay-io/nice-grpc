import {ClientError, ClientMiddleware} from 'nice-grpc-common';
import {decodeErrorDetails} from '../ErrorDetails';
import {Status} from '../proto/google/rpc/status';
import {RichClientError} from './RichClientError';

export const errorDetailsClientMiddleware: ClientMiddleware =
  async function* errorDetailsClientMiddleware(call, options) {
    let status: Status | undefined;

    try {
      return yield* call.next(call.request, {
        ...options,
        onTrailer(trailer) {
          const detailsBuffer = trailer.get('grpc-status-details-bin');

          if (detailsBuffer != null) {
            status = Status.decode(detailsBuffer);
          }

          options.onTrailer?.(trailer);
        },
      });
    } catch (err) {
      if (status != null && err instanceof ClientError) {
        throw new RichClientError(
          err.path,
          err.code,
          err.details,
          decodeErrorDetails(status.details),
        );
      }

      throw err;
    }
  };
