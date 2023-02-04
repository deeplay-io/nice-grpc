import {Metadata} from 'nice-grpc-common';
import {Base64} from 'js-base64';

/** @internal */
export function decodeMetadata(data: Uint8Array): Metadata {
  const metadata = Metadata();

  const text = new TextDecoder().decode(data);

  for (const line of text.split('\r\n')) {
    if (!line) {
      continue;
    }

    const splitIndex = line.indexOf(':');

    if (splitIndex === -1) {
      throw new Error(`Invalid metadata line: ${line}`);
    }

    const key = line.slice(0, splitIndex).trim().toLowerCase();
    const value = line.slice(splitIndex + 1).trim();

    if (key.endsWith('-bin')) {
      for (const item of value.split(/,\s?/)) {
        metadata.append(key, Base64.toUint8Array(item));
      }
    } else {
      metadata.append(key, value);
    }
  }

  return metadata;
}
