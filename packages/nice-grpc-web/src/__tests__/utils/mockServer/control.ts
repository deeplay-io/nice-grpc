import {
  forever,
  isAbortError,
  rethrowAbortError,
  run,
  spawn,
  waitForEvent,
} from 'abort-controller-x';
import {CallContext, Metadata, ServerError, Status} from 'nice-grpc-common';
import {AsyncSink} from '../../../utils/AsyncSink';
import {metadataFromJson, metadataToJson} from './metadata';
import {MockServerCommand, MockServerEvent} from './types';
import WebSocket, {MessageEvent} from 'isomorphic-ws';
import {
  TestRequest,
  TestServiceImplementation,
} from '../../../../fixtures/ts-proto/test';

export type RemoteTestServer = {
  address: string;
  shutdown(): void;
};

export async function startRemoteTestServer(
  implementation: Partial<TestServiceImplementation>,
  proxyType: 'grpcwebproxy' | 'envoy' = 'grpcwebproxy',
): Promise<RemoteTestServer> {
  const mockServerHost = globalThis.location?.host ?? 'localhost:18283';
  const protocol = globalThis.location?.protocol === 'https:' ? 'wss' : 'ws';

  const ws = new WebSocket(
    `${protocol}://${mockServerHost}/mock-server?proxy=${proxyType}`,
  );

  let nextSeq = 0;

  function sendCommand(command: MockServerCommand) {
    const commandToSend = {
      ...command,
      seq: nextSeq++,
    };
    // console.log('client sending', commandToSend);
    ws.send(JSON.stringify(commandToSend));
  }

  // ws.addEventListener('message', message => {
  //   console.log('client receiving', JSON.parse(message.data.toString()));
  // });

  function onEventOnce<Type extends string>(
    type: Type,
    callback: (event: Extract<MockServerEvent, {type: Type}>) => void,
  ) {
    const listener = (event: MessageEvent): void => {
      const data = JSON.parse(event.data.toString()) as MockServerEvent;

      if (data.type === type) {
        callback(data as any);
        ws.removeEventListener('message', listener);
      }
    };

    ws.addEventListener('message', listener);
  }

  async function processCall(
    method: string,
    metadata: Record<string, string[]>,
    request: AsyncIterable<TestRequest>,
  ) {
    const abortController = new AbortController();

    onEventOnce('aborted', () => {
      abortController.abort();
    });

    let sentHeader = false;

    const context: CallContext = {
      metadata: metadataFromJson(metadata),
      peer: 'dummy',
      header: Metadata(),
      trailer: Metadata(),
      signal: abortController.signal,
      sendHeader() {
        maybeFlushHeader();

        sendCommand({type: 'send-header'});
      },
    };

    function maybeFlushHeader() {
      if (sentHeader) {
        return;
      }

      sentHeader = true;

      sendCommand({
        type: 'set-header',
        header: metadataToJson(context.header),
      });
    }

    function flushTrailer() {
      sendCommand({
        type: 'set-trailer',
        trailer: metadataToJson(context.trailer),
      });
    }

    async function getUnaryRequest() {
      for await (const item of request) {
        return item;
      }

      throw new Error('Unexpected end of request stream');
    }

    function handleError(err: unknown) {
      maybeFlushHeader();

      if (err instanceof ServerError) {
        flushTrailer();
        sendCommand({
          type: 'throw',
          status: err.code,
          message: err.details,
        });
      } else if (isAbortError(err)) {
        // do nothing
      } else {
        throw err;
      }
    }

    if (method === 'testUnary') {
      const methodImpl = implementation.testUnary ?? throwUnimplemented;

      try {
        const unaryRequest = await getUnaryRequest();
        const response = await methodImpl(unaryRequest, context);

        maybeFlushHeader();

        flushTrailer();
        sendCommand({
          type: 'respond',
          id: response.id ?? '',
        });
      } catch (err) {
        handleError(err);
      }
    } else if (method === 'testServerStream') {
      const methodImpl = implementation.testServerStream ?? throwUnimplemented;

      try {
        for await (const response of methodImpl(
          await getUnaryRequest(),
          context,
        )) {
          maybeFlushHeader();

          sendCommand({
            type: 'respond',
            id: response.id ?? '',
          });
        }

        flushTrailer();
        sendCommand({type: 'finish'});
      } catch (err) {
        handleError(err);
      }
    } else if (method === 'testClientStream') {
      const methodImpl = implementation.testClientStream ?? throwUnimplemented;

      try {
        const response = await methodImpl(request, context);

        maybeFlushHeader();

        flushTrailer();
        sendCommand({
          type: 'respond',
          id: response.id ?? '',
        });
      } catch (err) {
        handleError(err);
      }
    } else if (method === 'testBidiStream') {
      const methodImpl = implementation.testBidiStream ?? throwUnimplemented;

      try {
        for await (const response of methodImpl(request, context)) {
          maybeFlushHeader();

          sendCommand({
            type: 'respond',
            id: response.id ?? '',
          });
        }

        flushTrailer();
        sendCommand({type: 'finish'});
      } catch (err) {
        handleError(err);
      }
    } else {
      throw new Error(`Unexpected method: ${method}`);
    }
  }

  const stop = run(signal =>
    spawn(signal, async (signal, {defer, fork}) => {
      defer(() => ws.close());

      fork(async signal => {
        const event = await waitForEvent<CloseEvent>(signal, ws, 'close');

        throw new Error(`WebSocket closed: ${event.code} ${event.reason}`);
      });

      onEventOnce('call-started', event => {
        const request = new AsyncSink<TestRequest>();

        ws.addEventListener('message', message => {
          const event = JSON.parse(message.data.toString()) as MockServerEvent;

          if (event.type === 'request') {
            request.write({id: event.id});
          } else if (event.type === 'finish') {
            request.end();
          }
        });

        processCall(event.method, event.metadata, request);
      });

      await forever(signal);
    }).catch(err => {
      rethrowAbortError(err);

      console.log('Mock server control error:', err);

      throw err;
    }),
  );

  await new Promise<void>(resolve => {
    onEventOnce('listening', () => {
      resolve();
    });
  });

  return {
    address: globalThis.location?.origin ?? 'http://localhost:48080',
    shutdown() {
      stop();
    },
  };
}

function throwUnimplemented(): never {
  throw new ServerError(Status.UNIMPLEMENTED, '');
}
