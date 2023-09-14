import { isAbortError } from 'abort-controller-x';
import { Message } from 'google-protobuf';
import {
  CallOptions,
  ClientError,
  ClientMiddleware,
  ClientMiddlewareCall,
  composeClientMiddleware,
} from 'nice-grpc-web';

export const devtoolsUnaryLoggingMiddleware: ClientMiddleware = async function* devtoolsLoggingMiddleware<Request, Response>(
  call: ClientMiddlewareCall<Request, Response>,
  options: CallOptions
): AsyncGenerator<Response, Response | void, undefined> {
  // skip streaming calls
  if (call.requestStream || call.responseStream) {
    return yield* call.next(call.request, options);
  }

  const { path } = call.method;

  let reqObj: any = undefined;

  // TODO: When would it not be a jspb.Message?
  if (call.request instanceof Message) {
    const reqMsg = call.request as Message;
    reqObj = reqMsg.toObject();
  } else {
    //eslint-disable-next-line
    reqObj = call.request;
    // console.warn('TODO: Request isn\'t a jspb.Message');
  }

  try {
    const result = yield* call.next(call.request, options);
    let resObj: any = undefined;
    // TODO: When would it not be a jspb.Message?
    if (result instanceof Message) {
      const resMsg = result as Message;
      resObj = resMsg.toObject();
    } else {
      //eslint-disable-next-line
      resObj = result;
      // console.warn("TODO: Response isn't a jspb.Message");
    }
    window.postMessage(
      {
        method: path,
        methodType: 'unary',
        request: reqObj,
        response: resObj,
        type: '__GRPCWEB_DEVTOOLS__',
      },
      '*'
    );
    return result;
  } catch (error) {
    if (error instanceof ClientError) {
      window.postMessage(
        {
          error: {
            code: error?.code,
            message: `${error?.message || error}`,
            // meta: error?.meta,
            // methodName: error?.methodName,
            name: error?.name,
            // serviceName: error?.serviceName,
            stack: error?.stack,
          },
          method: path,
          methodType: 'unary',
          request: reqObj,
          type: '__GRPCWEB_DEVTOOLS__',
        },
        '*'
      );
    } else if (isAbortError(error)) {
      //eslint-disable-next-line
      console.debug('GRPC REQUEST CANCEL', path);
    } else {
      //eslint-disable-next-line
      console.error('GRPC RESPONSE FAILURE', path, error);
    }

    throw error;
  }
};

export const devtoolsStreamLoggingMiddleware: ClientMiddleware = async function* devtoolsLoggingMiddleware<Request, Response>(
  call: ClientMiddlewareCall<Request, Response>,
  options: CallOptions
): AsyncGenerator<Response, Response | void, undefined> {
  const { path } = call.method;

  let reqObj: any = undefined;

  // TODO: When would it not be a jspb.Message?
  if (call.request instanceof Message) {
    const reqMsg = call.request as Message;
    reqObj = reqMsg.toObject();
  } else {
    //eslint-disable-next-line
    reqObj = call.request;
  }

  if (!call.responseStream && !call.requestStream) {
    // UNARY
    return yield* call.next(call.request, options);
  }
  // server streaming
  let first = true;
  try {
    for await (const response of call.next(call.request, options)) {
      // log response here
      let resObj: any = undefined;
      if (response instanceof Message) {
        const resMsg = response as Message;
        resObj = resMsg.toObject();
      } else {
        resObj = response;
      }
      if (first) {
        window.postMessage(
          {
            method: path,
            methodType: 'server_streaming',
            request: reqObj,
            type: '__GRPCWEB_DEVTOOLS__',
          },
          '*'
        );
        first = false;
      }
      window.postMessage(
        {
          method: path,
          methodType: 'server_streaming',
          response: resObj,
          type: '__GRPCWEB_DEVTOOLS__',
        },
        '*'
      );

      yield response;
    }
  } catch (error) {
    if (error instanceof ClientError) {
      window.postMessage(
        {
          error: {
            code: error?.code,
            message: `${error?.message || error}`,
            // meta: error?.meta,
            // methodName: error?.methodName,
            name: error?.name,
            // serviceName: error?.serviceName,
            stack: error?.stack,
          },
          method: path,
          methodType: 'server_streaming',
          type: '__GRPCWEB_DEVTOOLS__',
        },
        '*'
      );
    } else if (isAbortError(error)) {
      //eslint-disable-next-line
      console.debug('GRPC REQUEST CANCEL', path);
    } else {
      //eslint-disable-next-line
      console.error('GRPC RESPONSE FAILURE', path, error);
    }

    throw error;
  }
};

export const devtoolsLoggingMiddleware: ClientMiddleware = composeClientMiddleware(
  devtoolsUnaryLoggingMiddleware,
  devtoolsStreamLoggingMiddleware
);
