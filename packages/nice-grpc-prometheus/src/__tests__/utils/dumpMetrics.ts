import {Registry} from 'prom-client';

export async function dumpMetrics(registry: Registry) {
  const metricsString = await registry.metrics();

  return metricsString
    .split('\n')
    .map(line => {
      if (
        line.includes('handling_seconds_bucket') ||
        line.includes('handling_seconds_sum')
      ) {
        return line.replace(/(\d+(?:\.\d+)?)$/, '<num>');
      }

      return line;
    })
    .join('\n');
}
