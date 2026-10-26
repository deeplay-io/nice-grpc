import * as http from 'http';
import * as https from 'https';

/**
 * On Linux, proxy containers are run in the host network. Otherwise Docker
 * creates a network interface for each container, and Chrome treats its
 * appearance or removal as a network change, failing in-flight requests with
 * `net::ERR_NETWORK_CHANGED`.
 *
 * On other platforms Docker runs containers in a VM, which does not affect
 * host network interfaces.
 */
export const useHostNetwork = process.platform === 'linux';

export async function waitForHttpStatus(
  url: string,
  status: number,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const actualStatus = await getHttpStatus(url).catch(() => undefined);

    if (actualStatus === status) {
      return;
    }

    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for ${url} to respond with status ${status}, last status: ${actualStatus}`,
      );
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

function getHttpStatus(url: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const callback = (response: http.IncomingMessage) => {
      response.resume();
      resolve(response.statusCode);
    };

    const request = url.startsWith('https:')
      ? https.get(url, {rejectUnauthorized: false}, callback)
      : http.get(url, callback);

    request.on('error', reject);
  });
}
