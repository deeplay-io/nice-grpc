import * as grpc from '@grpc/grpc-js';
import {
  fromGrpcJsServiceDefinition,
  FromGrpcJsServiceDefinition,
  isGrpcJsServiceDefinition,
} from './grpc-js';
import {
  fromTsProtoServiceDefinition,
  FromTsProtoServiceDefinition,
  isTsProtoServiceDefinition,
  TsProtoServiceDefinition,
} from './ts-proto';

export type ServiceDefinition = {
  [method: string]: AnyMethodDefinition;
};

export type MethodDefinition<
  RequestIn,
  RequestOut,
  ResponseIn,
  ResponseOut,
  RequestStream extends boolean = boolean,
  ResponseStream extends boolean = boolean,
> = {
  path: string;
  requestStream: RequestStream;
  responseStream: ResponseStream;
  requestSerialize(value: RequestIn): Uint8Array;
  requestDeserialize(bytes: Uint8Array): RequestOut;
  responseSerialize(value: ResponseIn): Uint8Array;
  responseDeserialize(bytes: Uint8Array): ResponseOut;
  options: {
    idempotencyLevel?: 'IDEMPOTENT' | 'NO_SIDE_EFFECTS';
  };
};

export type AnyMethodDefinition = MethodDefinition<any, any, any, any>;

export type CompatServiceDefinition =
  | ServiceDefinition
  | grpc.ServiceDefinition
  | TsProtoServiceDefinition;

export type NormalizedServiceDefinition<
  Service extends CompatServiceDefinition,
> = Service extends ServiceDefinition
  ? Service
  : Service extends grpc.ServiceDefinition
  ? FromGrpcJsServiceDefinition<Service>
  : Service extends TsProtoServiceDefinition
  ? FromTsProtoServiceDefinition<Service>
  : never;

/** @internal */
export function normalizeServiceDefinition(
  definition: CompatServiceDefinition,
): ServiceDefinition {
  if (isGrpcJsServiceDefinition(definition)) {
    return fromGrpcJsServiceDefinition(definition);
  } else if (isTsProtoServiceDefinition(definition)) {
    return fromTsProtoServiceDefinition(definition);
  } else {
    return definition;
  }
}

/** @internal */
export function toGrpcJsServiceDefinition(
  definition: ServiceDefinition,
): grpc.ServiceDefinition {
  const result: {[key: string]: grpc.MethodDefinition<any, any>} = {};

  for (const [key, method] of Object.entries(definition)) {
    result[key] = toGrpcJsMethodDefinition(method);
  }

  return result;
}

/** @internal */
export function toGrpcJsMethodDefinition(
  definition: AnyMethodDefinition,
): grpc.MethodDefinition<any, any> {
  return {
    path: definition.path,
    requestStream: definition.requestStream,
    responseStream: definition.responseStream,
    requestDeserialize: definition.requestDeserialize,
    requestSerialize: value => Buffer.from(definition.requestSerialize(value)),
    responseDeserialize: definition.responseDeserialize,
    responseSerialize: value =>
      Buffer.from(definition.responseSerialize(value)),
  };
}
