import {randomBytes} from 'crypto';
import {
  createChannel,
  createServer,
  waitForChannelReady,
  Channel,
  ChannelCredentials,
} from '..';

test('implicit protocol', async () => {
  const server = createServer();

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`127.0.0.1:${port}`);
  await waitForChannelReady(channel, new Date(Date.now() + 1000));

  channel.close();
  await server.shutdown();
});

test('http', async () => {
  const server = createServer();

  const port = await server.listen('127.0.0.1:0');

  const channel = createChannel(`http://127.0.0.1:${port}`);
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

test('implicit protocol, secure credentials', () => {
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createSsl();
  const channel = createChannel(address, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${443}"`);
});

test('implicit protocol, secure credentials, custom port', () => {
  const port = '8080';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createSsl();
  const channel = createChannel(`${address}:${port}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${port}"`);
});

test('implicit protocol, insecure credentials', () => {
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createInsecure();
  const channel = createChannel(address, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${80}"`);
});

test('implicit protocol, insecure credentials, custom port', () => {
  const port = '8080';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createInsecure();
  const channel = createChannel(`${address}:${port}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${port}"`);
});

test('implicit protocol, no credentials', () => {
  const address = 'private.host.private';
  const channel = createChannel(address);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${80}"`);
});

test('explicit protocol, insecure credentials', () => {
  const protocol = 'https://';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createInsecure();
  const channel = createChannel(`${protocol}${address}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${443}"`);
});

test('explicit protocol, insecure credentials, custom port', () => {
  const protocol = 'http://';
  const port = '8080';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createInsecure();
  const channel = createChannel(`${protocol}${address}:${port}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${port}"`);
});

test('explicit protocol, secure credentials', () => {
  const protocol = 'http://';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createSsl();
  const channel = createChannel(`${protocol}${address}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${443}"`);
});

test('explicit protocol, secure credentials, custom port', () => {
  const protocol = 'http://';
  const port = '8080';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createSsl();
  const channel = createChannel(`${protocol}${address}:${port}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${port}"`);
});

test('explicit protocol, no credentials', () => {
  const protocol = 'https://';
  const address = 'private.host.private';
  const channel = createChannel(`${protocol}${address}`);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}:${443}"`);
});

test('unknown protocol, no credentials', () => {
  const address = 'consul://server';
  const channel = createChannel(address);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(`"dns:${address}"`);
});

test('unknown protocol, insecure credentials', () => {
  const protocol = 'consul://';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createInsecure();
  const channel = createChannel(`${protocol}${address}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(
    `"dns:${protocol}${address}"`,
  );
});

test('unknown protocol, insecure credentials, custom port', () => {
  const protocol = 'consul://';
  const port = '8080';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createInsecure();
  const channel = createChannel(`${protocol}${address}:${port}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(
    `"dns:${protocol}${address}:${port}"`,
  );
});

test('unknown protocol, secure credentials', () => {
  const protocol = 'consul://';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createSsl();
  const channel = createChannel(`${protocol}${address}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(
    `"dns:${protocol}${address}"`,
  );
});

test('unknown protocol, secure credentials, custom port', () => {
  const protocol = 'consul://';
  const port = '8080';
  const address = 'private.host.private';
  const credentials = ChannelCredentials.createSsl();
  const channel = createChannel(`${protocol}${address}:${port}`, credentials);

  expect(channel).toBeInstanceOf(Channel);
  expect(channel.getTarget()).toMatchInlineSnapshot(
    `"dns:${protocol}${address}:${port}"`,
  );
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
