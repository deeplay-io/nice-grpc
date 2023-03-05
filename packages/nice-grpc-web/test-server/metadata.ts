import {Base64} from 'js-base64';
import {Metadata} from 'nice-grpc-common';

export function metadataToJson(metadata: Metadata): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [key, values] of metadata) {
    result[key] = values.map(value =>
      typeof value === 'string' ? value : Base64.fromUint8Array(value),
    );
  }

  return result;
}

export function metadataFromJson(json: Record<string, string[]>): Metadata {
  const metadata = new Metadata();

  for (const [key, values] of Object.entries(json)) {
    for (const value of values) {
      metadata.append(
        key,
        key.endsWith('-bin') ? Base64.toUint8Array(value) : value,
      );
    }
  }

  return metadata;
}
