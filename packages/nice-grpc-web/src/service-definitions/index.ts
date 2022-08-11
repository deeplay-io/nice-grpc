import {grpc} from '@improbable-eng/grpc-web';
import {
  fromGrpcWebServiceDefinition,
  FromGrpcWebServiceDefinition,
  isGrpcWebServiceDefinition,
} from './grpc-web';
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
  ? FromGrpcWebServiceDefinition<Service>
  : Service extends TsProtoServiceDefinition
  ? FromTsProtoServiceDefinition<Service>
  : never;

/** @internal */
export function normalizeServiceDefinition(
  definition: CompatServiceDefinition,
): ServiceDefinition {
  if (isGrpcWebServiceDefinition(definition)) {
    return fromGrpcWebServiceDefinition(definition);
  } else if (isTsProtoServiceDefinition(definition)) {
    return fromTsProtoServiceDefinition(definition);
  } else {
    return definition;
  }
}

/** @internal */
export function toGrpcWebMethodDefinition(
  definition: AnyMethodDefinition,
): grpc.MethodDefinition<any, any> {
  const [, serviceName, methodName] = definition.path.split('/');

  return {
    service: {
      serviceName,
    },
    methodName,
    requestStream: definition.requestStream,
    responseStream: definition.responseStream,
    requestType: class {
      constructor() {
        throw new Error('Unexpected instantiation');
      }

      static deserializeBinary(bytes: Uint8Array) {
        return definition.requestDeserialize(bytes);
      }
    },
    responseType: class {
      constructor() {
        throw new Error('Unexpected instantiation');
      }

      static deserializeBinary(bytes: Uint8Array) {
        return definition.responseDeserialize(bytes);
      }
    },
  };
}
