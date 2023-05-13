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
  PreconditionFailure_Violation,
  BadRequest_FieldViolation,
  QuotaFailure_Violation,
  RichClientError,
  RichServerError,
  ErrorDetails,
} from '.';
import {CustomErrorDetail, TestDefinition} from '../fixtures/test';

const beforeEachServerAndClientTest = async (
  code: Status,
  extraErrorDetail: ErrorDetails[],
) => {
  const server = createServer().use(errorDetailsServerMiddleware);

  server.add(TestDefinition, {
    async testUnary() {
      throw new RichServerError(code, 'test-message', extraErrorDetail);
    },
  });

  const port = await server.listen('localhost:0');

  const channel = createChannel(`localhost:${port}`);

  const rawClient = createClient(TestDefinition, channel);

  const rawClientError = await rawClient.testUnary({}).catch(err => err);

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

  channel.close();
  await server.shutdown();

  expect(rawClientError).toBeInstanceOf(ClientError);
  expect(rawClientError.name).toBe('ClientError');
  expect(rawClientError.path).toBe('/nice_grpc.test.Test/TestUnary');
  expect(rawClientError.details).toBe('test-message');

  expect(trailer?.has('grpc-status-details-bin')).toBe(true);

  expect(richClientError).toBeInstanceOf(ClientError);
  expect(richClientError).toBeInstanceOf(RichClientError);
  expect(richClientError.name).toBe('RichClientError');
  expect(richClientError.path).toBe('/nice_grpc.test.Test/TestUnary');
  expect(richClientError.details).toBe('test-message');

  return {
    rawClientError,
    richClientError,
  };
};

describe('server and client', () => {
  const helpPartial = Help.fromPartial({
    links: [
      {
        url: 'help-url',
        description: 'help-description',
      },
    ],
  });
  const anyPartial = Any.fromPartial({
    typeUrl: `types.googleapis.com/${CustomErrorDetail.$type}`,
    value: CustomErrorDetail.encode(
      CustomErrorDetail.fromPartial({test: 'custom-test'}),
    ).finish(),
  });

  it('should be instance of preconditionFailure when server throws preconditionFailure error', async () => {
    const preConditionFailError = [
      PreconditionFailure.fromPartial({
        violations: [
          {
            type: 'type1',
            subject: 'subject1',
            description: 'description1',
          },
          {
            type: 'type2',
            subject: 'subject2',
            description: 'description2',
          },
        ],
      }),
      helpPartial,
      anyPartial,
    ];
    const {rawClientError, richClientError} =
      await beforeEachServerAndClientTest(
        Status.FAILED_PRECONDITION,
        preConditionFailError,
      );

    expect(rawClientError.code).toBe(Status.FAILED_PRECONDITION);

    expect(richClientError.code).toBe(Status.FAILED_PRECONDITION);
    expect(richClientError.extra).toEqual(preConditionFailError);
  });

  it('should be instance of preconditionFailure violation when server throws preconditionFailureViolation error', async () => {
    const preconditionFailureViolationError = [
      PreconditionFailure_Violation.fromPartial({
        type: 'type',
        subject: 'subject',
        description: 'description',
      }),
      helpPartial,
      anyPartial,
    ];
    const {rawClientError, richClientError} =
      await beforeEachServerAndClientTest(
        Status.FAILED_PRECONDITION,
        preconditionFailureViolationError,
      );

    expect(rawClientError.code).toBe(Status.FAILED_PRECONDITION);

    expect(richClientError.code).toBe(Status.FAILED_PRECONDITION);
    expect(richClientError.extra).toEqual(preconditionFailureViolationError);
  });

  it('should be instance of badRequest field violation when server throws BadRequest_FieldViolation error', async () => {
    const badRequestFieldViolationError = [
      BadRequest_FieldViolation.fromPartial({
        field: 'field',
        description: 'description',
      }),
      helpPartial,
      anyPartial,
    ];
    const {rawClientError, richClientError} =
      await beforeEachServerAndClientTest(
        Status.INVALID_ARGUMENT,
        badRequestFieldViolationError,
      );

    expect(rawClientError.code).toBe(Status.INVALID_ARGUMENT);

    expect(richClientError.code).toBe(Status.INVALID_ARGUMENT);
    expect(richClientError.extra).toEqual(badRequestFieldViolationError);
  });

  it('should be instance of quota failure violation when server throws QuotaFailure_Violation error', async () => {
    const quotaFailureViolationError = [
      QuotaFailure_Violation.fromPartial({
        subject: 'subject',
        description: 'description',
      }),
      helpPartial,
      anyPartial,
    ];
    const {rawClientError, richClientError} =
      await beforeEachServerAndClientTest(
        Status.DEADLINE_EXCEEDED,
        quotaFailureViolationError,
      );

    expect(rawClientError.code).toBe(Status.DEADLINE_EXCEEDED);

    expect(richClientError.code).toBe(Status.DEADLINE_EXCEEDED);
    expect(richClientError.extra).toEqual(quotaFailureViolationError);
  });
});
