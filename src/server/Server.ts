import {
  ChannelOptions,
  Server as GrpcServer,
  ServerCredentials,
  ServiceDefinition,
  UntypedServiceImplementation,
} from '@grpc/grpc-js';
import {composeServerMiddleware} from './composeServerMiddleware';
import {createBidiStreamingMethodHandler} from './handleBidiStreamingCall';
import {createClientStreamingMethodHandler} from './handleClientStreamingCall';
import {createServerStreamingMethodHandler} from './handleServerStreamingCall';
import {createUnaryMethodHandler} from './handleUnaryCall';
import {ServerMiddleware} from './ServerMiddleware';
import {ServiceImplementation} from './ServiceImplementation';

export type Server<CallContextExt = {}> = {
  use<Ext>(
    middleware: ServerMiddleware<Ext, CallContextExt>,
  ): Server<CallContextExt & Ext>;

  with<Ext>(
    middleware: ServerMiddleware<Ext, CallContextExt>,
  ): ServerAddBuilder<CallContextExt & Ext>;
  add<Service extends ServiceDefinition>(
    definition: Service,
    implementation: ServiceImplementation<Service, CallContextExt>,
  ): void;

  listen(address: string, credentials?: ServerCredentials): Promise<void>;

  shutdown(): Promise<void>;
  forceShutdown(): void;
};

export type ServerAddBuilder<CallContextExt> = {
  with<Ext>(
    middleware: ServerMiddleware<Ext, CallContextExt>,
  ): ServerAddBuilder<CallContextExt & Ext>;
  add<Service extends ServiceDefinition>(
    definition: Service,
    implementation: ServiceImplementation<Service, CallContextExt>,
  ): void;
};

export function createServer(options: ChannelOptions = {}): Server {
  return createServerWithMiddleware(options);
}

function createServerWithMiddleware<CallContextExt = {}>(
  options: ChannelOptions,
  middleware?: ServerMiddleware<CallContextExt>,
): Server<CallContextExt> {
  const services = new Map<
    ServiceDefinition,
    {
      middleware?: ServerMiddleware<any, any>;
      implementation: ServiceImplementation<ServiceDefinition, any>;
    }
  >();

  let server: GrpcServer | undefined;

  function createAddBuilder<CallContextExt>(
    middleware?: ServerMiddleware<CallContextExt>,
  ): ServerAddBuilder<CallContextExt> {
    return {
      with<Ext>(newMiddleware: ServerMiddleware<Ext, CallContextExt>) {
        return createAddBuilder(
          middleware == null
            ? (newMiddleware as ServerMiddleware<Ext & CallContextExt>)
            : composeServerMiddleware(middleware, newMiddleware),
        );
      },
      add(definition, implementation) {
        if (server != null) {
          throw new Error('server.add() must be used before listen()');
        }

        services.set(definition, {middleware, implementation});
      },
    };
  }

  return {
    use<Ext>(newMiddleware: ServerMiddleware<Ext, CallContextExt>) {
      if (server != null) {
        throw new Error('server.use() must be used before listen()');
      }

      if (services.size > 0) {
        throw new Error('server.use() must be used before adding any services');
      }

      return createServerWithMiddleware(
        options,
        middleware == null
          ? (newMiddleware as ServerMiddleware<Ext & CallContextExt>)
          : composeServerMiddleware(middleware, newMiddleware),
      );
    },

    ...createAddBuilder(middleware),

    async listen(address, credentials) {
      if (server != null) {
        throw new Error('server.listen() has already been called');
      }

      server = new GrpcServer(options);

      for (const [definition, {middleware, implementation}] of services) {
        const grpcImplementation: UntypedServiceImplementation = {};

        for (const [methodName, methodDefinition] of Object.entries(
          definition,
        )) {
          const methodImplementation = (implementation as any)[methodName].bind(
            implementation,
          );

          if (!methodDefinition.requestStream) {
            if (!methodDefinition.responseStream) {
              grpcImplementation[methodName] = createUnaryMethodHandler(
                methodDefinition,
                methodImplementation,
                middleware,
              );
            } else {
              grpcImplementation[
                methodName
              ] = createServerStreamingMethodHandler(
                methodDefinition,
                methodImplementation,
                middleware,
              );
            }
          } else {
            if (!methodDefinition.responseStream) {
              grpcImplementation[
                methodName
              ] = createClientStreamingMethodHandler(
                methodDefinition,
                methodImplementation,
                middleware,
              );
            } else {
              grpcImplementation[methodName] = createBidiStreamingMethodHandler(
                methodDefinition,
                methodImplementation,
                middleware,
              );
            }
          }
        }

        server.addService(definition, grpcImplementation);
      }

      await new Promise<void>((resolve, reject) => {
        server!.bindAsync(
          address,
          credentials ?? ServerCredentials.createInsecure(),
          err => {
            if (err != null) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      });

      server.start();
    },

    async shutdown() {
      if (server == null) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server!.tryShutdown(err => {
          if (err != null) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      server = undefined;
    },

    forceShutdown() {
      if (server == null) {
        return;
      }

      server!.forceShutdown();
      server = undefined;
    },
  };
}
