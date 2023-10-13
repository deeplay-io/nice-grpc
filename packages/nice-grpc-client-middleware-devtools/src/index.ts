import {isAbortError} from 'abort-controller-x';
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
    options: CallOptions & Partial<DevtoolsLoggingOptions>,
  ): AsyncGenerator<Response, Response | void, undefined> {
    // skip streaming calls
    if (call.requestStream || call.responseStream) {
      return yield* call.next(call.request, options);
    }

    // log unary calls
    const {path} = call.method;
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
        '*',
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
          '*',
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
            '*',
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
          '*',
        );
      }

      throw error;
    }
  };

export const devtoolsStreamLoggingMiddleware: ClientMiddleware<DevtoolsLoggingOptions> =
  async function* devtoolsLoggingMiddleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions & Partial<DevtoolsLoggingOptions>,
  ): AsyncGenerator<Response, Response | void, undefined> {
    // skip unary calls
    if (!call.responseStream && !call.requestStream) {
      return yield* call.next(call.request, options);
    }

    // log streaming calls
    const {path} = call.method;

    try {
      if (!call.requestStream) {
        // server streaming, the most prominent streaming option in grpc-web
        let first = true;
        for await (const response of call.next(call.request, options)) {
          if (first) {
            // log the request object only once and after the first response to not have duplicate logs in case of an error
            logStreamingRequestMessage(call.request, path);
            first = false;
          }
          logStreamingResponseMessage(response, path);
          yield response;
        }
        return;
      } else {
        const request = emitRequestMessages(call.request, path);
        if (!call.responseStream) {
          // client streaming
          const response = yield* call.next(request, options);
          logStreamingResponseMessage(response, path);
          return response;
        } else {
          // bidirectional streaming
          yield* emitResponseMessages(call.next(request, options), path);
          return;
        }
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
          '*',
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
            '*',
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
          '*',
        );
      }

      throw error;
    }
  };

export const devtoolsLoggingMiddleware: ClientMiddleware<DevtoolsLoggingOptions> =
  composeClientMiddleware(
    devtoolsUnaryLoggingMiddleware,
    devtoolsStreamLoggingMiddleware,
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

async function* emitRequestMessages<T>(
  iterable: AsyncIterable<T>,
  path: string,
): AsyncIterable<T> {
  for await (const request of iterable) {
    logStreamingRequestMessage(request, path);
    yield request;
  }
}

async function* emitResponseMessages<T>(
  iterable: AsyncIterable<T>,
  path: string,
): AsyncIterable<T> {
  for await (const reponse of iterable) {
    logStreamingResponseMessage(reponse, path);
    yield reponse;
  }
}

function logStreamingResponseMessage<T>(response: T, path: string) {
  const resObj = getAsObject(response);
  window.postMessage(
    {
      method: path,
      methodType: 'server_streaming',
      response: resObj,
      type: '__GRPCWEB_DEVTOOLS__',
    },
    '*',
  );
}

function logStreamingRequestMessage<T>(request: T, path: string) {
  const reqObj = getAsObject(request);
  window.postMessage(
    {
      method: path,
      methodType: 'server_streaming',
      request: reqObj,
      type: '__GRPCWEB_DEVTOOLS__',
    },
    '*',
  );
}
