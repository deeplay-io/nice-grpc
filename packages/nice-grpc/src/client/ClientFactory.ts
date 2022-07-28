import {Channel, makeClientConstructor} from '@grpc/grpc-js';
import {
  CallOptions,
  ClientMiddleware,
  composeClientMiddleware,
} from 'nice-grpc-common';
import {
  AnyMethodDefinition,
  CompatServiceDefinition,
  NormalizedServiceDefinition,
  normalizeServiceDefinition,
  ServiceDefinition,
} from '../service-definitions';
import {Client} from './Client';
import {createBidiStreamingMethod} from './createBidiStreamingMethod';
import {createClientStreamingMethod} from './createClientStreamingMethod';
import {createServerStreamingMethod} from './createServerStreamingMethod';
import {createUnaryMethod} from './createUnaryMethod';

export type ClientFactory<CallOptionsExt = {}> = {
  use<Ext>(
    middleware: ClientMiddleware<Ext, CallOptionsExt>,
  ): ClientFactory<CallOptionsExt & Ext>;

  create<Service extends CompatServiceDefinition>(
    definition: Service,
    channel: Channel,
    defaultCallOptions?: DefaultCallOptions<
      NormalizedServiceDefinition<Service>,
      CallOptionsExt
    >,
  ): Client<Service, CallOptionsExt>;
};

export type DefaultCallOptions<
  Service extends ServiceDefinition,
  CallOptionsExt = {},
> = {
  [K in keyof Service | '*']?: CallOptions & Partial<CallOptionsExt>;
};

export function createClientFactory(): ClientFactory {
  return createClientFactoryWithMiddleware();
}

export function createClient<Service extends CompatServiceDefinition>(
  definition: Service,
  channel: Channel,
  defaultCallOptions?: DefaultCallOptions<NormalizedServiceDefinition<Service>>,
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

    create<Service extends CompatServiceDefinition>(
      definition: Service,
      channel: Channel,
      defaultCallOptions: DefaultCallOptions<
        NormalizedServiceDefinition<Service>,
        CallOptionsExt
      > = {},
    ) {
      const constructor = makeClientConstructor({}, '');
      const grpcClient = new constructor('', null!, {
        channelOverride: channel,
      });

      type NormalizedService = NormalizedServiceDefinition<Service>;

      const client = {} as {
        [K in keyof NormalizedService]: Function;
      };

      const methodEntries = Object.entries(
        normalizeServiceDefinition(definition),
      ) as Array<[keyof NormalizedService, AnyMethodDefinition]>;

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
