import {MethodDescriptor} from '../MethodDescriptor';
import {CallContext} from './CallContext';

export type ServerMiddleware<
  CallContextExt = {},
  RequiredCallContextExt = {}
> = <Request, Response>(
  call: ServerMiddlewareCall<
    Request,
    Response,
    CallContextExt & RequiredCallContextExt
  >,
  context: CallContext & RequiredCallContextExt,
) => AsyncGenerator<Response, Response | void, undefined>;

export type ServerMiddlewareCall<Request, Response, NextCallContextExt = {}> = {
  method: MethodDescriptor;
} & ServerMiddlewareCallRequest<Request> &
  ServerMiddlewareCallResponse<Request, Response, NextCallContextExt>;

export type ServerMiddlewareCallRequest<Request> =
  | {
      requestStream: false;
      request: Request;
    }
  | {
      requestStream: true;
      request: AsyncIterable<Request>;
    };

export type ServerMiddlewareCallResponse<
  Request,
  Response,
  NextCallContextExt
> =
  | {
      responseStream: false;
      next(
        request: Request | AsyncIterable<Request>,
        context: CallContext & NextCallContextExt,
      ): AsyncGenerator<never, Response, undefined>;
    }
  | {
      responseStream: true;
      next(
        request: Request | AsyncIterable<Request>,
        context: CallContext & NextCallContextExt,
      ): AsyncGenerator<Response, void, undefined>;
    };
