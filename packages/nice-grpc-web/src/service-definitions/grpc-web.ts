import {CompatServiceDefinition, MethodDefinition, ServiceDefinition} from '.';

export interface GrpcWebServiceDefinition {
  serviceName: string;
}

export interface GrpcWebMethodDefinition<
  TRequest extends ProtobufMessage,
  TResponse extends ProtobufMessage,
> {
  methodName: string;
  service: GrpcWebServiceDefinition;
  requestStream: boolean;
  responseStream: boolean;
  requestType: ProtobufMessageClass<TRequest>;
  responseType: ProtobufMessageClass<TResponse>;
}

export interface GrpcWebUnaryMethodDefinition<
  TRequest extends ProtobufMessage,
  TResponse extends ProtobufMessage,
> extends GrpcWebMethodDefinition<TRequest, TResponse> {
  requestStream: false;
  responseStream: false;
}

export interface ProtobufMessageClass<T extends ProtobufMessage> {
  new (): T;
  deserializeBinary(bytes: Uint8Array): T;
}

export interface ProtobufMessage {
  toObject(): {};
  serializeBinary(): Uint8Array;
}

export type FromGrpcWebServiceDefinition<
  Service extends GrpcWebServiceDefinition,
> = {
  [M in GrpcWebServiceMethodKeys<Service> as Uncapitalize<M>]: FromGrpcWebMethodDefinition<
    Service[M]
  >;
};

export type GrpcWebServiceMethodKeys<Service extends GrpcWebServiceDefinition> =
  {
    [K in keyof Service]: Service[K] extends GrpcWebMethodDefinition<any, any>
      ? K
      : never;
  }[keyof Service] &
    string;

export type FromGrpcWebMethodDefinition<Method> =
  Method extends GrpcWebMethodDefinition<infer Request, infer Response>
    ? MethodDefinition<
        Request,
        Request,
        Response,
        Response,
        Method['requestStream'],
        Method['responseStream']
      >
    : never;

export function fromGrpcWebServiceDefinition(
  definition: GrpcWebServiceDefinition,
): ServiceDefinition {
  const result: ServiceDefinition = {};

  for (const [key, value] of Object.entries(definition)) {
    if (key === 'serviceName') {
      continue;
    }

    const method = value as GrpcWebMethodDefinition<any, any>;

    result[uncapitalize(key)] = {
      path: `/${definition.serviceName}/${key}`,
      requestStream: method.requestStream,
      responseStream: method.responseStream,
      requestDeserialize: method.requestType.deserializeBinary,
      requestSerialize: (value: ProtobufMessage) => value.serializeBinary(),
      responseDeserialize: method.responseType.deserializeBinary,
      responseSerialize: (value: ProtobufMessage) => value.serializeBinary(),
      options: {},
    };
  }

  return result;
}

export function isGrpcWebServiceDefinition(
  definition: CompatServiceDefinition,
): definition is GrpcWebServiceDefinition {
  return 'prototype' in definition;
}

function uncapitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value[0].toLowerCase() + value.slice(1);
}
