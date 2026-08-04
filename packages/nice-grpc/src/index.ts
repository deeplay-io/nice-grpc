import {applyConnectTimeoutPatch} from './client/connectTimeoutPatch';

// Works around the missing connection attempt timeout in grpc-js, which
// otherwise leaves channels stuck in CONNECTING forever when a network path
// accepts connections but never responds. See the module for details.
applyConnectTimeoutPatch();

export * from 'nice-grpc-common';

export * from './server/Server';
export * from './server/ServiceImplementation';

export {createChannel, waitForChannelReady} from './client/channel';
export {Channel, ChannelOptions, ChannelCredentials} from '@grpc/grpc-js';
export * from './client/ClientFactory';
export * from './client/Client';

export {
  ServiceDefinition,
  MethodDefinition,
  CompatServiceDefinition,
  NormalizedServiceDefinition,
} from './service-definitions';
export {TsProtoServiceDefinition} from './service-definitions/ts-proto';
export {ServiceDefinition as GrpcJsServiceDefinition} from '@grpc/grpc-js';
