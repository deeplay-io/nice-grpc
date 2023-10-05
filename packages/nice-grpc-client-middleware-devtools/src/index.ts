import { isAbortError } from 'abort-controller-x';
import {
  CallOptions,
  ClientError,
  ClientMiddleware,
  ClientMiddlewareCall,
  composeClientMiddleware,
} from 'nice-grpc-common';

export type DevtoolsLoggingOptions = {
  /**
   * Skip logging abort errors.
   * 
   * By default, abort errors are logged.
   */
  skipAbortErrorLogging?: boolean;
};

export const devtoolsUnaryLoggingMiddleware: ClientMiddleware<DevtoolsLoggingOptions> =
  async function* devtoolsLoggingMiddleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions & Partial<DevtoolsLoggingOptions>
  ): AsyncGenerator<Response, Response | void, undefined> {
    // skip streaming calls
    if (call.requestStream || call.responseStream) {
      return yield* call.next(call.request, options);
    }

    // log unary calls
    const { path } = call.method;
    const reqObj = getAsObject(call.request);

    try {
      const result = yield* call.next(call.request, options);
      const resObj = getAsObject(result);
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
              name: error?.name,
              stack: error?.stack,
            },
            method: path,
            methodType: 'unary',
            request: reqObj,
            type: '__GRPCWEB_DEVTOOLS__',
          },
          '*'
        );
      } else if (isAbortError(error) && error instanceof Error) {
        if (!options.skipAbortErrorLogging) {
          window.postMessage(
            {
              error: {
                code: 1,
                message: `${error?.message || error}`,
                name: error?.name,
                stack: error?.stack,
              },
              method: path,
              methodType: 'unary',
              request: reqObj,
              type: '__GRPCWEB_DEVTOOLS__',
            },
            '*'
          );
        }
      } else if (error instanceof Error) {
        window.postMessage(
          {
            error: {
              code: 2,
              message: `${error?.message || error}`,
              name: error?.name,
              stack: error?.stack,
            },
            method: path,
            methodType: 'unary',
            request: reqObj,
            type: '__GRPCWEB_DEVTOOLS__',
          },
          '*'
        );
      }

      throw error;
    }
  };

export const devtoolsStreamLoggingMiddleware: ClientMiddleware<DevtoolsLoggingOptions> =
  async function* devtoolsLoggingMiddleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions & Partial<DevtoolsLoggingOptions>
  ): AsyncGenerator<Response, Response | void, undefined> {
    // skip unary calls
    if (!call.responseStream && !call.requestStream) {
      return yield* call.next(call.request, options);
    }

    // log streaming calls
    const { path } = call.method;
    const reqObj = getAsObject(call.request);

    let first = true;
    try {
      for await (const response of call.next(call.request, options)) {
        const resObj = getAsObject(response);
        if (first) {
          // log the request object only once
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
        // log the response
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
              name: error?.name,
              stack: error?.stack,
            },
            method: path,
            methodType: 'server_streaming',
            type: '__GRPCWEB_DEVTOOLS__',
          },
          '*'
        );
      } else if (isAbortError(error) && error instanceof Error) {
        if (!options.skipAbortErrorLogging) {
          window.postMessage(
            {
              error: {
                code: 1,
                message: `${error?.message || error}`,
                name: error?.name,
                stack: error?.stack,
              },
              method: path,
              methodType: 'server_streaming',
              type: '__GRPCWEB_DEVTOOLS__',
            },
            '*'
          );
        }
      } else if (error instanceof Error) {
        window.postMessage(
          {
            error: {
              code: 2,
              message: `${error?.message || error}`,
              name: error?.name,
              stack: error?.stack,
            },
            method: path,
            methodType: 'server_streaming',
            type: '__GRPCWEB_DEVTOOLS__',
          },
          '*'
        );
      }

      throw error;
    }
  };

export const devtoolsLoggingMiddleware: ClientMiddleware<DevtoolsLoggingOptions> = composeClientMiddleware(
  devtoolsUnaryLoggingMiddleware,
  devtoolsStreamLoggingMiddleware
);

// check whether the given object has toObject() method and return the object
// otherwise return the object itself
function getAsObject(obj: any) {
  if ('toObject' in obj && typeof obj.toObject === 'function') {
    // google-protobuf
    return obj.toObject();
  }
  // ts-proto
  return obj;
}