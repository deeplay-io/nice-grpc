import TypedEventEmitter from 'typed-emitter';
import {EventEmitter} from 'events';

export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

export type HealthState = TypedEventEmitter<HealthEvents> &
  EventEmitter & {
    setStatus(status: HealthStatus, service?: string): void;

    getStatus(service?: string): HealthStatus;
  };

export type HealthStatusChangeEvent = {
  status: HealthStatus;
  service: string;
};

export type HealthEvents = {
  change: (event: HealthStatusChangeEvent) => void;
};

export function HealthState(): HealthState {
  const emitter = new EventEmitter() as TypedEventEmitter<HealthEvents>;

  const statuses = new Map<string, 'healthy' | 'unhealthy'>();

  statuses.set('', 'healthy');

  return Object.assign(emitter, {
    setStatus(status: HealthStatus, service = '') {
      const prevStatus = statuses.get(service) ?? 'unknown';

      if (prevStatus === status) {
        return;
      }

      if (status === 'unknown') {
        statuses.delete(service);
      } else {
        statuses.set(service, status);
      }

      emitter.emit('change', {status, service});
    },

    getStatus(service = '') {
      return statuses.get(service) ?? 'unknown';
    },
  });
}
