import {throwIfAborted} from 'abort-controller-x';
import {Base64} from 'js-base64';
import {ClientError, Metadata, Status} from 'nice-grpc-common';
import {Transport} from "nice-grpc-web/lib/client/Transport";

class GrpcCallData {
    responseHeaders: Metadata = new Metadata();
    responseChunks: Uint8Array[] = [];
    grpcStatus: Status = Status.UNKNOWN;
    statusMessage: string = "";
}

export interface XHRTransportConfig {
    credentials?: boolean;
}

async function xhrPost(url: string, metadata: Metadata, requestBody: BodyInit, config?: XHRTransportConfig): Promise<GrpcCallData> {
    const callData: GrpcCallData = new GrpcCallData();
    return new Promise(function(resolve, reject) {
        // TODO - Support fallback for node?
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.withCredentials = config?.credentials ?? true;
        xhr.responseType = "arraybuffer";

        for (const [key, values] of metadata) {
            for (const value of values) {
                xhr.setRequestHeader(
                    key,
                    typeof value === 'string' ? value : Base64.fromUint8Array(value),
                );
            }
        }

        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
                callData.responseHeaders = headersToMetadata(xhr.getAllResponseHeaders());
            } else if (xhr.readyState === XMLHttpRequest.DONE) {
                resolve(callData);
            }
        }
        xhr.onerror = function() {
            callData.statusMessage = getErrorDetailsFromHttpResponse(xhr.status, xhr.statusText);
        }
        xhr.onloadend = function() {
            callData.responseChunks.push(new Uint8Array(xhr.response as ArrayBuffer));
            callData.grpcStatus = getStatusFromHttpCode(xhr.status);
        }

        // Tested, this works.
        // @ts-ignore
        xhr.send(requestBody);
    });
}

function concatenateChunks(chunks: Uint8Array[]): Uint8Array {
    // Using the performant method vs spread syntax: https://stackoverflow.com/a/60590943
    let totalSize = 0;
    for (const chunk of chunks) {
        totalSize += chunk.length;
    }
    const newData = new Uint8Array(totalSize)
    let setIndex = 0;
    for (const chunk of chunks) {
        newData.set(chunk, setIndex);
        setIndex += chunk.length;
    }
    return newData;
}

/**
 * Transport for browsers based on `XMLHttpRequest` API.
 */
export function XHRTransport(config?: XHRTransportConfig): Transport {
    return async function* fetchTransport({url, body, metadata, signal, method}) {
        let requestBody: BodyInit;

        if (!method.requestStream) {
            let bodyBuffer: Uint8Array | undefined;

            for await (const chunk of body) {
                bodyBuffer = chunk;

                break;
            }

            requestBody = bodyBuffer!;
        } else {
            let iterator: AsyncIterator<Uint8Array> | undefined;

            requestBody = new ReadableStream({
                // @ts-ignore
                type: 'bytes',
                start() {
                    iterator = body[Symbol.asyncIterator]();
                },

                async pull(controller) {
                    const {done, value} = await iterator!.next();

                    if (done) {
                        controller.close();
                    } else {
                        controller.enqueue(value);
                    }
                },
                async cancel() {
                    await iterator!.return?.();
                },
            });
        }

        const xhrData = await xhrPost(url, metadata, requestBody, config);

        yield {
            type: 'header',
            header: xhrData.responseHeaders,
        };

        if (xhrData.grpcStatus !== Status.OK) {
            const decoder = new TextDecoder();
            const message = decoder.decode(concatenateChunks(xhrData.responseChunks));
            console.warn(message, xhrData.statusMessage);
            throw new ClientError(
                method.path,
                xhrData.grpcStatus,
                `status=${xhrData.statusMessage}, message=${message}`
            );
        }

        throwIfAborted(signal);

        try {
            for (const xhrChunk of xhrData.responseChunks) {
                if (xhrChunk != null) {
                    yield {
                        type: 'data',
                        data: xhrChunk,
                    };
                }
            }
        } finally {
            throwIfAborted(signal);
        }
    };
}

function headersToMetadata(headers: string): Metadata {
    const metadata = new Metadata();
    const arr = headers.trim().split(/[\r\n]+/);

    arr.forEach((line) => {
        const parts = line.split(': ');
        const header = parts.shift() ?? "";
        const value = parts.join(': ');
        metadata.set(header, value);
    });
    return metadata;
}

function getStatusFromHttpCode(statusCode: number): Status {
    switch (statusCode) {
        case 200:
            return Status.OK;
        case 400:
            return Status.INTERNAL;
        case 401:
            return Status.UNAUTHENTICATED;
        case 403:
            return Status.PERMISSION_DENIED;
        case 404:
            return Status.UNIMPLEMENTED;
        case 429:
        case 502:
        case 503:
        case 504:
            return Status.UNAVAILABLE;
        default:
            return Status.UNKNOWN;
    }
}

function getErrorDetailsFromHttpResponse(
    statusCode: number,
    responseText: string,
): string {
    return (
        `Received HTTP ${statusCode} response: ` +
        (responseText.length > 1000
            ? responseText.slice(0, 1000) + '... (truncated)'
            : responseText)
    );
}
