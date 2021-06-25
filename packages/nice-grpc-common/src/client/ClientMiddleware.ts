import {MethodDescriptor} from '../MethodDescriptor';
import {CallOptions} from './CallOptions';

export type ClientMiddleware<
  CallOptionsExt = {},
  RequiredCallOptionsExt = {},
> = <Request, Response>(
  call: ClientMiddlewareCall<Request, Response, RequiredCallOptionsExt>,
  options: CallOptions & Partial<CallOptionsExt & RequiredCallOptionsExt>,
) => AsyncGenerator<Response, Response | void, undefined>;

export type ClientMiddlewareCall<Request, Response, NextCallOptionsExt = {}> = {
  method: MethodDescriptor;
} & ClientMiddlewareCallRequest<Request> &
  ClientMiddlewareCallResponse<Request, Response, NextCallOptionsExt>;

export type ClientMiddlewareCallRequest<Request> =
  | {
      requestStream: false;
      request: Request;
    }
  | {
      requestStream: true;
      request: AsyncIterable<Request>;
    };

export type ClientMiddlewareCallResponse<
  Request,
  Response,
  NextCallOptionsExt,
> =
  | {
      responseStream: false;
      next(
        request: Request | AsyncIterable<Request>,
        options: CallOptions & Partial<NextCallOptionsExt>,
      ): AsyncGenerator<never, Response, undefined>;
    }
  | {
      responseStream: true;
      next(
        request: Request | AsyncIterable<Request>,
        options: CallOptions & Partial<NextCallOptionsExt>,
      ): AsyncGenerator<Response, void, undefined>;
    };
