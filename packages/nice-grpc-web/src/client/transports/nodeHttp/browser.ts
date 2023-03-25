import {Transport} from '../../Transport';

export function NodeHttpTransport(): Transport {
  throw new Error('NodeHttpTransport is not supported in the browser');
}
