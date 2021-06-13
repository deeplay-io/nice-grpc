import {Metadata} from '@grpc/grpc-js';
import {AbortSignal} from 'node-abort-controller';

export type CallOptions = {
  deadline?: Date;
  metadata?: Metadata;
  signal?: AbortSignal;
  onHeader?(header: Metadata): void;
  onTrailer?(trailer: Metadata): void;
};
