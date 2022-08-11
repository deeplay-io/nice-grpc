import {grpc} from '@improbable-eng/grpc-web';
import {Metadata} from 'nice-grpc-common';
import {Base64} from 'js-base64';

export function convertMetadataToGrpcWeb(metadata: Metadata): grpc.Metadata {
  const grpcMetadata = new grpc.Metadata();

  for (const [key, values] of metadata) {
    for (const value of values) {
      grpcMetadata.append(
        key,
        typeof value === 'string' ? value : Base64.fromUint8Array(value),
      );
    }
  }

  return grpcMetadata;
}

export function convertMetadataFromGrpcWeb(
  grpcMetadata: grpc.Metadata,
): Metadata {
  const metadata = Metadata();

  for (const [key, values] of Object.entries(grpcMetadata.headersMap)) {
    metadata.set(
      key,
      key.endsWith('-bin')
        ? values.map(value => Base64.toUint8Array(value))
        : values,
    );
  }

  return metadata;
}
