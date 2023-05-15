import {
  BadRequest,
  BadRequest_FieldViolation,
  DebugInfo,
  ErrorInfo,
  Help,
  LocalizedMessage,
  PreconditionFailure,
  PreconditionFailure_Violation,
  QuotaFailure,
  QuotaFailure_Violation,
  RequestInfo,
  ResourceInfo,
  RetryInfo,
} from './proto/google/rpc/error_details';
import {Any} from './proto/google/protobuf/any';
import {MessageType} from './proto/typeRegistry';

export type ErrorDetails =
  | RetryInfo
  | DebugInfo
  | QuotaFailure
  | QuotaFailure_Violation
  | ErrorInfo
  | PreconditionFailure
  | PreconditionFailure_Violation
  | BadRequest
  | BadRequest_FieldViolation
  | RequestInfo
  | ResourceInfo
  | Help
  | LocalizedMessage
  | Any;

const knownMessages = [
  RetryInfo,
  DebugInfo,
  QuotaFailure,
  QuotaFailure_Violation,
  ErrorInfo,
  PreconditionFailure,
  PreconditionFailure_Violation,
  BadRequest,
  BadRequest_FieldViolation,
  RequestInfo,
  ResourceInfo,
  Help,
  LocalizedMessage,
] as Array<MessageType<ErrorDetails>>;

/* @internal */
export function decodeErrorDetails(details: Any[]): ErrorDetails[] {
  return details.map(value => {
    const messageType = knownMessages.find(type =>
      value.typeUrl.endsWith(`/${type.$type}`),
    );

    if (messageType == null) {
      return value;
    }

    return messageType.decode(value.value);
  });
}

/* @internal */
export function encodeErrorDetails(details: ErrorDetails[]): Any[] {
  return details.map(value => {
    if (value.$type === Any.$type) {
      return value;
    }

    const messageType = knownMessages.find(type => type.$type === value.$type);

    if (messageType == null) {
      throw new Error(`Unknown error details type: ${value.$type}`);
    }

    return Any.fromPartial({
      typeUrl: `type.googleapis.com/${value.$type}`,
      value: messageType.encode(value).finish(),
    });
  });
}
