import {MethodDefinition} from '@grpc/grpc-js';

export type MethodRequest<
  Definition extends MethodDefinition<any, any>
> = Definition extends MethodDefinition<infer T, any> ? T : never;
export type MethodResponse<
  Definition extends MethodDefinition<any, any>
> = Definition extends MethodDefinition<any, infer T> ? T : never;
