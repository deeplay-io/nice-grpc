import {CallOptions} from 'nice-grpc-common';
import {
  CompatServiceDefinition,
  MethodDefinition,
  NormalizedServiceDefinition,
  ServiceDefinition,
} from '../service-definitions';
import {MethodRequestIn, MethodResponseOut} from '../utils/methodTypes';

export type Client<
  Service extends CompatServiceDefinition,
  CallOptionsExt = {},
> = RawClient<NormalizedServiceDefinition<Service>, CallOptionsExt>;

export type RawClient<
  Service extends ServiceDefinition,
  CallOptionsExt = {},
> = {
  [Method in keyof Service]: ClientMethod<Service[Method], CallOptionsExt>;
};

export type ClientMethod<
  Definition extends MethodDefinition<any, any, any, any>,
  CallOptionsExt = {},
> = Definition['requestStream'] extends false
  ? Definition['responseStream'] extends false
    ? UnaryClientMethod<
        MethodRequestIn<Definition>,
        MethodResponseOut<Definition>,
        CallOptionsExt
      >
    : Definition['responseStream'] extends true
    ? ServerStreamingClientMethod<
        MethodRequestIn<Definition>,
        MethodResponseOut<Definition>,
        CallOptionsExt
      >
    : never
  : Definition['requestStream'] extends true
  ? Definition['responseStream'] extends false
    ? ClientStreamingClientMethod<
        MethodRequestIn<Definition>,
        MethodResponseOut<Definition>,
        CallOptionsExt
      >
    : Definition['responseStream'] extends true
    ? BidiStreamingClientMethod<
        MethodRequestIn<Definition>,
        MethodResponseOut<Definition>,
        CallOptionsExt
      >
    : never
  : never;

export type UnaryClientMethod<RequestIn, ResponseOut, CallOptionsExt = {}> = (
  request: RequestIn,
  options?: CallOptions & CallOptionsExt,
) => Promise<ResponseOut>;

export type ServerStreamingClientMethod<
  RequestIn,
  ResponseOut,
  CallOptionsExt = {},
> = (
  request: RequestIn,
  options?: CallOptions & CallOptionsExt,
) => AsyncIterable<ResponseOut>;

export type ClientStreamingClientMethod<
  RequestIn,
  ResponseOut,
  CallOptionsExt = {},
> = (
  request: AsyncIterable<RequestIn>,
  options?: CallOptions & CallOptionsExt,
) => Promise<ResponseOut>;

export type BidiStreamingClientMethod<
  RequestIn,
  ResponseOut,
  CallOptionsExt = {},
> = (
  request: AsyncIterable<RequestIn>,
  options?: CallOptions & CallOptionsExt,
) => AsyncIterable<ResponseOut>;
