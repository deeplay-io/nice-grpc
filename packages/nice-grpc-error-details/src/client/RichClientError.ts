import {ClientError, Status} from 'nice-grpc-common';
import {ErrorDetails} from '../ErrorDetails';

export class RichClientError extends ClientError {
  extra: ErrorDetails[];

  constructor(
    path: string,
    code: Status,
    details: string,
    extra: ErrorDetails[],
  ) {
    super(path, code, details);

    this.name = 'RichClientError';
    this.extra = extra;
  }
}
