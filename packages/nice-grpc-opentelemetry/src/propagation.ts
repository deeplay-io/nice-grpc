import {TextMapGetter, TextMapSetter} from '@opentelemetry/api';
import {Metadata} from 'nice-grpc-common';

export const metadataSetter: TextMapSetter<Metadata> = {
  set(carrier, key, value) {
    carrier.set(key, value);
  },
};

export const metadataGetter: TextMapGetter<Metadata> = {
  get: (carrier, key) => carrier.get(key) as string | undefined,
  keys: carrier => Array.from(carrier, ([key]) => key),
};
