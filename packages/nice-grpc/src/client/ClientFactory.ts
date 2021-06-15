import {
  Channel,
  Client as GrpcClient,
  MethodDefinition,
  ServiceDefinition,
} from '@grpc/grpc-js';
import {KnownKeys} from '../utils/KnownKeys';
import {CallOptions} from './CallOptions';
import {Client} from './Client';
import {ClientMiddleware} from './ClientMiddleware';
import {composeClientMiddleware} from './composeClientMiddleware';
import {createBidiStreamingMethod} from './createBidiStreamingMethod';
import {createClientStreamingMethod} from './createClientStreamingMethod';
import {createServerStreamingMethod} from './createServerStreamingMethod';
import {createUnaryMethod} from './createUnaryMethod';

export type ClientFactory<CallOptionsExt = {}> = {
  use<Ext>(
    middleware: ClientMiddleware<Ext, CallOptionsExt>,
  ): ClientFactory<CallOptionsExt & Ext>;

  create<Service extends ServiceDefinition>(
    definition: Service,
    channel: Channel,
    defaultCallOptions?: DefaultCallOptions<Service, CallOptionsExt>,
  ): Client<Service, CallOptionsExt>;
};

export type DefaultCallOptions<
  Service extends ServiceDefinition,
  CallOptionsExt = {}
> = {
  [K in KnownKeys<Service> | '*']?: CallOptions & Partial<CallOptionsExt>;
};

export function createClientFactory(): ClientFactory {
  return createClientFactoryWithMiddleware();
}

export function createClient<Service extends ServiceDefinition>(
  definition: Service,
  channel: Channel,
  defaultCallOptions?: DefaultCallOptions<Service>,
): Client<Service> {
  return createClientFactory().create(definition, channel, defaultCallOptions);
}

function createClientFactoryWithMiddleware<CallOptionsExt = {}>(
  middleware?: ClientMiddleware<CallOptionsExt>,
): ClientFactory<CallOptionsExt> {
  return {
    use<Ext>(newMiddleware: ClientMiddleware<Ext, CallOptionsExt>) {
      return createClientFactoryWithMiddleware(
        middleware == null
          ? (newMiddleware as ClientMiddleware<Ext & CallOptionsExt>)
          : composeClientMiddleware(middleware, newMiddleware),
      );
    },

    create<Service extends ServiceDefinition>(
      definition: Service,
      channel: Channel,
      defaultCallOptions: DefaultCallOptions<Service, CallOptionsExt> = {},
    ) {
      const grpcClient = new GrpcClient('', null!, {
        channelOverride: channel,
      });

      const client = {} as {[K in KnownKeys<Service>]: Function};

      const methodEntries = Object.entries(definition) as Array<
        [KnownKeys<Service>, MethodDefinition<any, any>]
      >;

      for (const [methodName, methodDefinition] of methodEntries) {
        const defaultOptions = {
          ...defaultCallOptions['*'],
          ...defaultCallOptions[methodName],
        } as CallOptions;

        if (!methodDefinition.requestStream) {
          if (!methodDefinition.responseStream) {
            client[methodName] = createUnaryMethod(
              methodDefinition,
              grpcClient,
              middleware,
              defaultOptions,
            );
          } else {
            client[methodName] = createServerStreamingMethod(
              methodDefinition,
              grpcClient,
              middleware,
              defaultOptions,
            );
          }
        } else {
          if (!methodDefinition.responseStream) {
            client[methodName] = createClientStreamingMethod(
              methodDefinition,
              grpcClient,
              middleware,
              defaultOptions,
            );
          } else {
            client[methodName] = createBidiStreamingMethod(
              methodDefinition,
              grpcClient,
              middleware,
              defaultOptions,
            );
          }
        }
      }

      return client as Client<Service>;
    },
  };
}
