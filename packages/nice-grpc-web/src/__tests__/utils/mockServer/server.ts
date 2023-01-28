import getPort = require('get-port');
import {CallContext, createServer, ServerError} from 'nice-grpc';
import {WebSocketServer} from 'ws';
import {TestDefinition} from '../../../../fixtures/ts-proto/test';
import {AsyncSink} from '../../../utils/AsyncSink';
import {startEnvoyProxy} from '../envoyProxy';
import {startGrpcWebProxy} from '../grpcwebproxy';
import {metadataToJson, metadataFromJson} from './metadata';
import {MockServerCommand, MockServerEvent} from './types';
import * as selfsigned from 'selfsigned';
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';

export type MockServerLogger = {
  debug(message: any, ...args: any[]): void;
  info(message: any, ...args: any[]): void;
  warn(message: any, ...args: any[]): void;
  error(message: any, ...args: any[]): void;
};

export function startMockServer(logger: MockServerLogger): () => void {
  const certs = selfsigned.generate(
    [{name: 'commonName', value: 'localhost'}],
    {
      keySize: 2048,
    },
  );

  const tmpDir = tmp.dirSync();

  const certPath = path.join(tmpDir.name, 'tls.crt');
  fs.writeFileSync(certPath, certs.cert);
  const keyPath = path.join(tmpDir.name, 'tls.key');
  fs.writeFileSync(keyPath, certs.private);

  const wsServer = new WebSocketServer({port: 18283});

  wsServer.on('connection', (ws, request) => {
    const searchParams = new URLSearchParams(request.url?.slice(1));
    const proxyType = searchParams.get('proxy') ?? 'grpcwebproxy';

    let nextSeq = 0;

    function sendEvent(event: MockServerEvent) {
      const eventToSend = {
        ...event,
        seq: nextSeq++,
      };
      logger.debug(proxyType, 'server sending', eventToSend);
      ws.send(JSON.stringify(eventToSend));
    }

    ws.addEventListener('message', message => {
      logger.debug(
        proxyType,
        'server receiving',
        JSON.parse(message.data.toString()),
      );
    });

    function handleRequest(
      method: string,
      context: CallContext,
    ): AsyncGenerator<
      Extract<MockServerCommand, {type: 'respond' | 'finish'}>
    > {
      const commands = new AsyncSink<MockServerCommand>();

      ws.on('message', data => {
        const command = JSON.parse(data.toString()) as MockServerCommand;

        commands.write(command);
      });

      sendEvent({
        type: 'call-started',
        method,
        metadata: metadataToJson(context.metadata),
      });

      if (context.signal.aborted) {
        sendEvent({type: 'aborted'});
      } else {
        context.signal.addEventListener('abort', () => {
          sendEvent({type: 'aborted'});
        });
      }

      return processCommands();

      async function* processCommands() {
        for await (const command of commands) {
          if (command.type === 'set-header') {
            for (const [key, values] of metadataFromJson(command.header)) {
              context.header.set(key, values);
            }
          } else if (command.type === 'send-header') {
            context.sendHeader();
          } else if (command.type === 'set-trailer') {
            for (const [key, values] of metadataFromJson(command.trailer)) {
              context.trailer.set(key, values);
            }
          } else if (command.type === 'throw') {
            throw new ServerError(command.status, command.message);
          } else {
            yield command;
          }
        }
      }
    }

    const server = createServer();

    server.add(TestDefinition, {
      async testUnary(request, context) {
        const commands = handleRequest('testUnary', context);

        sendEvent({type: 'request', id: request.id});

        for await (const command of commands) {
          if (command.type === 'respond') {
            return {id: command.id};
          }
        }

        throw new Error('Unexpected end of commands');
      },
      async *testServerStream(request, context) {
        const commands = handleRequest('testServerStream', context);

        sendEvent({type: 'request', id: request.id});

        for await (const command of commands) {
          if (command.type === 'respond') {
            yield {id: command.id};
          } else if (command.type === 'finish') {
            return;
          }
        }

        throw new Error('Unexpected end of commands');
      },
      async testClientStream(request, context) {
        const commands = handleRequest('testClientStream', context);

        Promise.resolve()
          .then(async () => {
            for await (const message of request) {
              if (context.signal.aborted) {
                return;
              }

              sendEvent({type: 'request', id: message.id});
            }

            sendEvent({type: 'finish'});
          })
          .catch(() => {});

        for await (const command of commands) {
          if (command.type === 'respond') {
            return {id: command.id};
          }
        }

        throw new Error('Unexpected end of commands');
      },
      async *testBidiStream(request, context) {
        const commands = handleRequest('testBidiStream', context);

        Promise.resolve()
          .then(async () => {
            for await (const message of request) {
              if (context.signal.aborted) {
                return;
              }

              sendEvent({type: 'request', id: message.id});
            }

            sendEvent({type: 'finish'});
          })
          .catch(() => {});

        for await (const command of commands) {
          if (command.type === 'respond') {
            yield {id: command.id};
          } else if (command.type === 'finish') {
            return;
          }
        }

        throw new Error('Unexpected end of commands');
      },
    });

    const closePromise = new Promise<void>(resolve => {
      ws.on('close', () => {
        resolve();
      });
    });

    Promise.resolve().then(async () => {
      const listenPort = await server.listen('0.0.0.0:0');

      const startProxy =
        proxyType === 'envoy' ? startEnvoyProxy : startGrpcWebProxy;

      const proxyPort = await getPort();

      const proxy = await startProxy(proxyPort, listenPort, certPath, keyPath);

      sendEvent({type: 'listening', port: proxyPort});

      await closePromise;

      proxy.stop();
      await server.shutdown();
    });
  });

  return () => {
    wsServer.close();
    tmpDir.removeCallback();
  };
}
