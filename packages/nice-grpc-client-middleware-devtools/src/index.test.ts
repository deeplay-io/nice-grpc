import defer = require('defer-promise');
import {forever} from 'abort-controller-x';
import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {devtoolsLoggingMiddleware} from '.';
import {TestService} from '../fixtures/grpc-js/test_grpc_pb';
import {
  TestDefinition,
  TestRequest as TestRequestTS,
} from '../fixtures/ts-proto/test';
import {
  TestRequest as TestRequestJS,
  TestResponse as TestResponseJS,
} from '../fixtures/grpc-js/test_pb';

function throwUnimplemented(): never {
  throw new ServerError(Status.UNIMPLEMENTED, '');
}

let windowSpy: jest.SpyInstance;
let postMessageMock: jest.Mock;

beforeEach(() => {
  postMessageMock = jest.fn();
  windowSpy = jest.spyOn(window, 'postMessage');
  windowSpy.mockImplementation(postMessageMock);
});

afterEach(() => {
  windowSpy.mockRestore();
});

describe('devtools', () => {
  test('grpc-js logs unary calls', async () => {
    const server = createServer();

    server.add(TestService, {
      async testUnary(request: TestRequestJS, {signal}) {
        return new TestResponseJS();
      },
      testServerStream: throwUnimplemented,
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const port = await server.listen('127.0.0.1:0');

    const channel = createChannel(`127.0.0.1:${port}`);
    const client = createClientFactory()
      .use(devtoolsLoggingMiddleware)
      .create(TestService, channel);

    const req = new TestRequestJS();
    req.setId('test-id');

    const promise = client.testUnary(req);

    await expect(promise).resolves.toEqual(new TestResponseJS());
    await expect(postMessageMock).toHaveBeenCalledTimes(1);
    await expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          id: 'test-id',
        },
        response: {
          id: '',
        },
        methodType: 'unary',
        method: '/nice_grpc.test.Test/TestUnary',
      }),
      '*',
    );

    channel.close();

    await server.shutdown();
  });

  test('ts-proto logs unary calls', async () => {
    const server = createServer();

    server.add(TestService, {
      async testUnary(request: TestRequestJS, {signal}) {
        return new TestResponseJS();
      },
      testServerStream: throwUnimplemented,
      testClientStream: throwUnimplemented,
      testBidiStream: throwUnimplemented,
    });

    const port = await server.listen('127.0.0.1:0');

    const channel = createChannel(`127.0.0.1:${port}`);
    const client = createClientFactory()
      .use(devtoolsLoggingMiddleware)
      .create(TestDefinition, channel);

    const req: TestRequestTS = {id: 'test-id'};

    const promise = client.testUnary(req);

    await expect(promise).resolves.toEqual({id: ''});
    await expect(postMessageMock).toHaveBeenCalledTimes(1);
    await expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          id: 'test-id',
        },
        response: {
          id: '',
        },
        methodType: 'unary',
        method: '/nice_grpc.test.Test/TestUnary',
      }),
      '*',
    );

    channel.close();

    await server.shutdown();
  });
});
