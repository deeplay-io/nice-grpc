import {
  fromGrpcWebServiceDefinition,
  FromGrpcWebServiceDefinition,
  GrpcWebServiceDefinition,
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
  | GrpcWebServiceDefinition
  | TsProtoServiceDefinition;

export type NormalizedServiceDefinition<
  Service extends CompatServiceDefinition,
> = Service extends ServiceDefinition
  ? Service
  : Service extends GrpcWebServiceDefinition
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
