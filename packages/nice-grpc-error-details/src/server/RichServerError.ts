import {ServerError, Status} from 'nice-grpc-common';
import {ErrorDetails} from '../ErrorDetails';

export class RichServerError extends ServerError {
  extra: ErrorDetails[];

  constructor(code: Status, details: string, extra: ErrorDetails[] = []) {
    super(code, details);

    this.name = 'RichServerError';
    this.extra = extra;
  }
}
