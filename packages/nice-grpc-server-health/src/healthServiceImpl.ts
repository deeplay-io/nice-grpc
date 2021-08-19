import {waitForEvent} from 'abort-controller-x';
import {
  CallContext,
  ServerError,
  ServiceImplementation,
  Status,
} from 'nice-grpc';
import {
  HealthState,
  HealthStatus,
  HealthStatusChangeEvent,
} from './healthState';
import {
  HealthCheckRequest,
  HealthCheckResponse,
  HealthCheckResponse_ServingStatus,
  HealthDefinition,
} from './proto/grpc/health/v1/health';

export type MaybeTerminatorContext = {
  abortOnTerminate?(): void;
};

export type HealthServiceImpl = ServiceImplementation<
  typeof HealthDefinition,
  MaybeTerminatorContext
>;

export function HealthServiceImpl(
  healthState: HealthState = HealthState(),
): HealthServiceImpl {
  return {
    async check(
      request: HealthCheckRequest,
      context: CallContext & MaybeTerminatorContext,
    ): Promise<HealthCheckResponse> {
      const status = healthState.getStatus(request.service);

      if (status === 'unknown') {
        throw new ServerError(
          Status.NOT_FOUND,
          `Unknown service: '${request.service}'`,
        );
      }

      return {
        status:
          status === 'healthy'
            ? HealthCheckResponse_ServingStatus.SERVING
            : HealthCheckResponse_ServingStatus.NOT_SERVING,
      };
    },

    async *watch(
      request: HealthCheckRequest,
      context: CallContext & MaybeTerminatorContext,
    ): AsyncIterable<HealthCheckResponse> {
      context.abortOnTerminate?.();

      let lastStatus: HealthStatus | undefined;

      while (true) {
        const status = healthState.getStatus(request.service);

        if (status !== lastStatus) {
          yield {
            status:
              status === 'unknown'
                ? HealthCheckResponse_ServingStatus.SERVICE_UNKNOWN
                : status === 'healthy'
                ? HealthCheckResponse_ServingStatus.SERVING
                : HealthCheckResponse_ServingStatus.NOT_SERVING,
          };
        }

        await waitForEvent<HealthStatusChangeEvent>(
          context.signal,
          healthState,
          'change',
        );
      }
    },
  };
}
