import getPort = require('get-port');
import {createChannel, waitForChannelReady} from '../client/channel';
import {createServer} from '../server/Server';

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

test('invalid protocol', () => {
  expect(() =>
    createChannel('htttp://localhost:123'),
  ).toThrowErrorMatchingInlineSnapshot(
    `"Unsupported protocol: 'htttp'. Expected one of 'http', 'https'"`,
  );
});

test('waitForChannelReady deadline', async () => {
  const address = `localhost:${await getPort()}`;

  const channel = createChannel(address);
  await expect(
    waitForChannelReady(channel, new Date(Date.now() + 1000)),
  ).rejects.toMatchInlineSnapshot(
    `[Error: Deadline passed without connectivity state change]`,
  );

  channel.close();
});
