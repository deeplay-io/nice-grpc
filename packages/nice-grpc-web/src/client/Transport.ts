import {Metadata} from 'nice-grpc-common';
import {MethodDefinition} from '../service-definitions';

export type TransportParams = {
  url: string;
  metadata: Metadata;
  body: AsyncIterable<Uint8Array>;
  signal: AbortSignal;
  method: MethodDefinition<unknown, unknown, unknown, unknown>;
};

export type Transport = (params: TransportParams) => AsyncIterable<Frame>;

export type Frame = HeaderFrame | MessageFrame | TrailerFrame;

export type HeaderFrame = {
  type: 'header';
  header: Metadata;
};

export type MessageFrame = {
  type: 'data';
  data: Uint8Array;
};

export type TrailerFrame = {
  type: 'trailer';
  trailer: Metadata;
};
