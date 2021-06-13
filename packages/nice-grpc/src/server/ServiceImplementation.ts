import {MethodDefinition, ServiceDefinition} from '@grpc/grpc-js';
import {CallContext} from './CallContext';
import {KnownKeys} from '../utils/KnownKeys';
import {MethodRequest, MethodResponse} from '../utils/methodTypes';

export type ServiceImplementation<
  Service extends ServiceDefinition,
  CallContextExt = {}
> = {
  [Method in KnownKeys<Service>]: MethodImplementation<
    Service[Method],
    CallContextExt
  >;
};

export type MethodImplementation<
  Definition extends MethodDefinition<any, any>,
  CallContextExt = {}
> = Definition['requestStream'] extends false
  ? Definition['responseStream'] extends false
    ? UnaryMethodImplementation<
        MethodRequest<Definition>,
        MethodResponse<Definition>,
        CallContextExt
      >
    : Definition['responseStream'] extends true
    ? ServerStreamingMethodImplementation<
        MethodRequest<Definition>,
        MethodResponse<Definition>,
        CallContextExt
      >
    : never
  : Definition['requestStream'] extends true
  ? Definition['responseStream'] extends false
    ? ClientStreamingMethodImplementation<
        MethodRequest<Definition>,
        MethodResponse<Definition>,
        CallContextExt
      >
    : Definition['responseStream'] extends true
    ? BidiStreamingMethodImplementation<
        MethodRequest<Definition>,
        MethodResponse<Definition>,
        CallContextExt
      >
    : never
  : never;

export type UnaryMethodImplementation<
  Request,
  Response,
  CallContextExt = {}
> = (
  request: Request,
  context: CallContext & CallContextExt,
) => Promise<Response>;

export type ServerStreamingMethodImplementation<
  Request,
  Response,
  CallContextExt = {}
> = (
  request: Request,
  context: CallContext & CallContextExt,
) => ServerStreamingMethodResult<Response>;

export type ClientStreamingMethodImplementation<
  Request,
  Response,
  CallContextExt = {}
> = (
  request: AsyncIterable<Request>,
  context: CallContext & CallContextExt,
) => Promise<Response>;

export type BidiStreamingMethodImplementation<
  Request,
  Response,
  CallContextExt = {}
> = (
  request: AsyncIterable<Request>,
  context: CallContext & CallContextExt,
) => ServerStreamingMethodResult<Response>;

export type ServerStreamingMethodResult<Response> = {
  [Symbol.asyncIterator](): AsyncIterator<Response, void>;
};
