import {grpc} from '@improbable-eng/grpc-web';
import {CompatServiceDefinition, MethodDefinition, ServiceDefinition} from '.';

export type FromGrpcWebServiceDefinition<
  Service extends grpc.ServiceDefinition,
> = {
  [M in GrpcWebServiceMethodKeys<Service> as Uncapitalize<M>]: FromGrpcWebMethodDefinition<
    Service[M]
  >;
};

export type GrpcWebServiceMethodKeys<Service extends grpc.ServiceDefinition> = {
  [K in keyof Service]: Service[K] extends grpc.MethodDefinition<any, any>
    ? K
    : never;
}[keyof Service] &
  string;

export type FromGrpcWebMethodDefinition<Method> =
  Method extends grpc.MethodDefinition<infer Request, infer Response>
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
  definition: grpc.ServiceDefinition,
): ServiceDefinition {
  const result: ServiceDefinition = {};

  for (const [key, value] of Object.entries(definition)) {
    if (key === 'serviceName') {
      continue;
    }

    const method = value as grpc.MethodDefinition<any, any>;

    result[uncapitalize(key)] = {
      path: `/${definition.serviceName}/${key}`,
      requestStream: method.requestStream,
      responseStream: method.responseStream,
      requestDeserialize: method.requestType.deserializeBinary,
      requestSerialize: (value: grpc.ProtobufMessage) =>
        value.serializeBinary(),
      responseDeserialize: method.responseType.deserializeBinary,
      responseSerialize: (value: grpc.ProtobufMessage) =>
        value.serializeBinary(),
      options: {},
    };
  }

  return result;
}

export function isGrpcWebServiceDefinition(
  definition: CompatServiceDefinition,
): definition is grpc.ServiceDefinition {
  return 'prototype' in definition;
}

function uncapitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value[0].toLowerCase() + value.slice(1);
}
