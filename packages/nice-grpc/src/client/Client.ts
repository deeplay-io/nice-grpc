import {MethodDefinition, ServiceDefinition} from '@grpc/grpc-js';
import {KnownKeys} from '../utils/KnownKeys';
import {MethodRequest, MethodResponse} from '../utils/methodTypes';
import {CallOptions} from './CallOptions';

export type Client<Service extends ServiceDefinition, CallOptionsExt = {}> = {
  [Method in KnownKeys<Service>]: ClientMethod<Service[Method], CallOptionsExt>;
};

export type ClientMethod<
  Definition extends MethodDefinition<any, any>,
  CallOptionsExt = {}
> = Definition['requestStream'] extends false
  ? Definition['responseStream'] extends false
    ? UnaryClientMethod<
        MethodRequest<Definition>,
        MethodResponse<Definition>,
        CallOptionsExt
      >
    : Definition['responseStream'] extends true
    ? ServerStreamingClientMethod<
        MethodRequest<Definition>,
        MethodResponse<Definition>,
        CallOptionsExt
      >
    : never
  : Definition['requestStream'] extends true
  ? Definition['responseStream'] extends false
    ? ClientStreamingClientMethod<
        MethodRequest<Definition>,
        MethodResponse<Definition>,
        CallOptionsExt
      >
    : Definition['responseStream'] extends true
    ? BidiStreamingClientMethod<
        MethodRequest<Definition>,
        MethodResponse<Definition>,
        CallOptionsExt
      >
    : never
  : never;

export type UnaryClientMethod<Request, Response, CallOptionsExt = {}> = (
  request: Request,
  options?: CallOptions & CallOptionsExt,
) => Promise<Response>;

export type ServerStreamingClientMethod<
  Request,
  Response,
  CallOptionsExt = {}
> = (
  request: Request,
  options?: CallOptions & CallOptionsExt,
) => AsyncIterable<Response>;

export type ClientStreamingClientMethod<
  Request,
  Response,
  CallOptionsExt = {}
> = (
  request: AsyncIterable<Request>,
  options?: CallOptions & CallOptionsExt,
) => Promise<Response>;

export type BidiStreamingClientMethod<
  Request,
  Response,
  CallOptionsExt = {}
> = (
  request: AsyncIterable<Request>,
  options?: CallOptions & CallOptionsExt,
) => AsyncIterable<Response>;
