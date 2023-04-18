import {Metadata, Status} from 'nice-grpc-common';

/** @internal */
export type ParsedTrailer = {
  status: Status;
  message?: string;
  trailer: Metadata;
};

/** @internal */
export function parseTrailer(trailer: Metadata): ParsedTrailer {
  let status: Status;

  const statusValue = trailer.get('grpc-status');

  if (statusValue != null) {
    const statusNum = +statusValue;

    if (statusNum in Status) {
      status = statusNum;
    } else {
      throw new Error(
        `Received invalid status code from server: ${statusValue}`,
      );
    }
  } else {
    throw new Error('Received no status code from server');
  }

  let message = trailer.get('grpc-message');

  if (message != null) {
    try {
      message = decodeURIComponent(message);
    } catch {
      // ignore
    }
  }

  const trailerCopy = Metadata(trailer);
  trailerCopy.delete('grpc-status');
  trailerCopy.delete('grpc-message');

  return {
    status,
    message,
    trailer: trailerCopy,
  };
}
