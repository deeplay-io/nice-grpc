import {
  Channel,
  createChannel,
  createClient,
  Metadata,
  WebsocketTransport,
} from '..';
import {TestDefinition} from '../../fixtures/ts-proto/test';
import {
  RemoteTestServer,
  startRemoteTestServer,
} from '../../test-server/client';

describe('defaultCallOptions', () => {
  let server: RemoteTestServer;
  let channel: Channel;

  beforeEach(async () => {
    server = await startRemoteTestServer({
      async testUnary(request, context) {
        const metadataValue = context.metadata.get('test') ?? '';
        return {id: metadataValue};
      },
    });

    channel = createChannel(server.address, WebsocketTransport());
  });

  afterEach(async () => {
    server.shutdown();
  });

  it('all methods', async () => {
    const metadata = Metadata();
    metadata.set('test', 'test-value');

    const client = createClient(TestDefinition, channel, {
      '*': {
        metadata,
      },
    });

    expect(await client.testUnary({})).toEqual({id: 'test-value'});
  });

  it('particular method', async () => {
    const defaultMetadata = Metadata();
    defaultMetadata.set('test', 'test-default-value');

    const metadata = Metadata();
    metadata.set('test', 'test-value');

    const client = createClient(TestDefinition, channel, {
      '*': {
        metadata: defaultMetadata,
      },
      testUnary: {
        metadata,
      },
    });

    expect(await client.testUnary({})).toEqual({id: 'test-value'});
  });
});
