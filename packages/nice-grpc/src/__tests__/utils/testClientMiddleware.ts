import {CallOptions, ClientMiddleware, ClientMiddlewareCall} from '../..';

export function createTestClientMiddleware<ExtraOption extends string>(
  extraOption: ExtraOption,
  actions: any[],
  actionTypePrefix: string = '',
): ClientMiddleware<{[K in ExtraOption]?: string}> {
  return async function* middleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions & {[K in ExtraOption]?: string},
  ) {
    const {[extraOption]: ext, ...restOptions} = options;

    actions.push({
      type: actionTypePrefix + 'start',
      requestStream: call.requestStream,
      responseStream: call.responseStream,
      options: {
        [extraOption]: ext,
      },
    });

    let request: Request | AsyncIterable<Request>;

    if (!call.requestStream) {
      actions.push({type: actionTypePrefix + 'request', request: call.request});
      request = call.request;
    } else {
      const requestIterable = call.request;
      async function* wrapRequest() {
        for await (const request of requestIterable) {
          actions.push({type: actionTypePrefix + 'request', request});
          yield request;
        }
      }
      request = wrapRequest();
    }

    try {
      if (!call.responseStream) {
        const response = yield* call.next(request, restOptions);

        actions.push({type: actionTypePrefix + 'response', response});

        return response;
      } else {
        for await (const response of call.next(request, restOptions)) {
          actions.push({type: actionTypePrefix + 'response', response});

          yield response;
        }

        return;
      }
    } catch (error) {
      actions.push({type: actionTypePrefix + 'error', error});
      throw error;
    }
  };
}
