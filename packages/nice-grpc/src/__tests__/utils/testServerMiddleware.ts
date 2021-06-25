import {CallContext, ServerMiddleware, ServerMiddlewareCall} from '../..';

export function createTestServerMiddleware<Ext>(
  contextExt: Ext,
  actions: any[],
  actionTypePrefix: string = '',
): ServerMiddleware<Ext> {
  return async function* middleware<Request, Response>(
    call: ServerMiddlewareCall<Request, Response, Ext>,
    context: CallContext,
  ) {
    actions.push({
      type: actionTypePrefix + 'start',
      requestStream: call.requestStream,
      responseStream: call.responseStream,
    });

    const nextContext: CallContext & Ext = {
      ...context,
      ...contextExt,
    };

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
        const response = yield* call.next(request, nextContext);

        actions.push({type: actionTypePrefix + 'response', response});

        return response;
      } else {
        for await (const response of call.next(request, nextContext)) {
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
