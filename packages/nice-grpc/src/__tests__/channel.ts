import getPort = require('get-port');
import {randomBytes} from 'crypto';
import {createChannel, createServer, waitForChannelReady, Channel} from '..';

test('implicit protocol', async () => {
  const address = `localhost:${await getPort()}`;

  const server = createServer();

  await server.listen(address);

  const channel = createChannel(address);
  await waitForChannelReady(channel, new Date(Date.now() + 1000));

  channel.close();
  await server.shutdown();
});

test('http', async () => {
  const address = `localhost:${await getPort()}`;

  const server = createServer();

  await server.listen(address);

  const channel = createChannel(`http://${address}`);
  await waitForChannelReady(channel, new Date(Date.now() + 1000));

  channel.close();
  await server.shutdown();
});

test('default port', async () => {
  const channel = createChannel('http://localhost');
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:localhost:80"`);
  channel.close();

  const secureChannel = createChannel('https://localhost');
  expect(secureChannel.getTarget()).toMatchInlineSnapshot(
    `"dns:localhost:443"`,
  );
  secureChannel.close();
});

test('unknown protocol', () => {
  const address = 'consul://server';
  const channel = createChannel(address);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}"`);
});

test('waitForChannelReady deadline', async () => {
  const address = `${randomBytes(16).toString('hex')}:80`;

  const channel = createChannel(address);
  await expect(
    waitForChannelReady(channel, new Date(Date.now() + 1000)),
  ).rejects.toMatchInlineSnapshot(
    `[Error: Deadline passed without connectivity state change]`,
  );

  channel.close();
});
