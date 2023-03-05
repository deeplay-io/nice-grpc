import {Status} from 'nice-grpc-common';

export type MockServerEvent =
  | {type: 'listening'; protocol: string; port: number}
  | {type: 'call-started'; method: string; metadata: Record<string, string[]>}
  | {type: 'request'; id: string}
  | {type: 'finish'}
  | {type: 'aborted'};

export type MockServerCommand =
  | {type: 'set-header'; header: Record<string, string[]>}
  | {type: 'send-header'}
  | {type: 'set-trailer'; trailer: Record<string, string[]>}
  | {type: 'respond'; id: string}
  | {type: 'throw'; status: Status; message: string}
  | {type: 'finish'};
