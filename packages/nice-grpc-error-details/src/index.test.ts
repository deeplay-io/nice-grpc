import {
  ClientError,
  createChannel,
  createClient,
  createClientFactory,
  createServer,
  Metadata,
  Status,
} from 'nice-grpc';
import {
  Any,
  errorDetailsClientMiddleware,
  errorDetailsServerMiddleware,
  Help,
  PreconditionFailure,
  RichClientError,
  RichServerError,
} from '.';
import {CustomErrorDetail, TestDefinition} from '../fixtures/test';

test('server and client', async () => {
  const server = createServer().use(errorDetailsServerMiddleware);

  server.add(TestDefinition, {
    async testUnary() {
      throw new RichServerError(Status.FAILED_PRECONDITION, 'test-message', [
        PreconditionFailure.fromPartial({
          violations: [
            {
              type: 'type1',
              subject: 'subject1',
              description: 'description1,',
            },
            {
              type: 'type2',
              subject: 'subject2',
              description: 'description2,',
            },
          ],
        }),
        Help.fromPartial({
          links: [
            {
              url: 'help-url',
              description: 'help-description',
            },
          ],
        }),
        Any.fromPartial({
          typeUrl: `types.googleapis.com/${CustomErrorDetail.$type}`,
          value: CustomErrorDetail.encode(
            CustomErrorDetail.fromPartial({test: 'custom-test'}),
          ).finish(),
        }),
      ]);
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);

  const rawClient = createClient(TestDefinition, channel);

  const rawClientError = await rawClient.testUnary({}).catch(err => err);
  expect(rawClientError).toBeInstanceOf(ClientError);
  expect(rawClientError.name).toBe('ClientError');
  expect(rawClientError.path).toBe('/nice_grpc.test.Test/TestUnary');
  expect(rawClientError.code).toBe(Status.FAILED_PRECONDITION);
  expect(rawClientError.details).toBe('test-message');

  const clientWithMiddleware = createClientFactory()
    .use(errorDetailsClientMiddleware)
    .create(TestDefinition, channel);

  let trailer: Metadata | undefined;

  const richClientError = await clientWithMiddleware
    .testUnary(
      {},
      {
        onTrailer(trailer_) {
          trailer = trailer_;
        },
      },
    )
    .catch(err => err);

  expect(trailer?.has('grpc-status-details-bin')).toBe(true);

  expect(richClientError).toBeInstanceOf(ClientError);
  expect(richClientError).toBeInstanceOf(RichClientError);
  expect(richClientError.name).toBe('RichClientError');
  expect(richClientError.path).toBe('/nice_grpc.test.Test/TestUnary');
  expect(richClientError.code).toBe(Status.FAILED_PRECONDITION);
  expect(richClientError.details).toBe('test-message');
  expect(richClientError.extra).toEqual([
    PreconditionFailure.fromPartial({
      violations: [
        {
          type: 'type1',
          subject: 'subject1',
          description: 'description1,',
        },
        {
          type: 'type2',
          subject: 'subject2',
          description: 'description2,',
        },
      ],
    }),
    Help.fromPartial({
      links: [
        {
          url: 'help-url',
          description: 'help-description',
        },
      ],
    }),
    Any.fromPartial({
      typeUrl: `types.googleapis.com/${CustomErrorDetail.$type}`,
      value: CustomErrorDetail.encode(
        CustomErrorDetail.fromPartial({test: 'custom-test'}),
      ).finish(),
    }),
  ]);

  channel.close();
  await server.shutdown();
});
