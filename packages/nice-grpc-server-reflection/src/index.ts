import {ServiceImplementation, Status} from 'nice-grpc';
import {
  DescriptorProto,
  EnumDescriptorProto,
  FileDescriptorProto,
  FileDescriptorSet,
  MethodDescriptorProto,
  ServiceDescriptorProto,
} from 'google-protobuf/google/protobuf/descriptor_pb';
import {IServerReflectionService} from './proto/grpc/reflection/v1alpha/reflection_grpc_pb';
import {
  ErrorResponse,
  ExtensionNumberResponse,
  FileDescriptorResponse,
  ListServiceResponse,
  ServerReflectionRequest,
  ServerReflectionResponse,
  ServiceResponse,
} from './proto/grpc/reflection/v1alpha/reflection_pb';

export {ServerReflectionService} from './proto/grpc/reflection/v1alpha/reflection_grpc_pb';

export function ServerReflection(
  protoset: Uint8Array,
  serviceNames: string[],
): ServiceImplementation<IServerReflectionService> {
  const fileDescriptorSet = FileDescriptorSet.deserializeBinary(protoset);

  function findSymbol(
    symbol: string,
    descriptor:
      | FileDescriptorProto
      | DescriptorProto
      | EnumDescriptorProto
      | ServiceDescriptorProto
      | MethodDescriptorProto,
    prefix: string = '',
  ):
    | DescriptorProto
    | EnumDescriptorProto
    | ServiceDescriptorProto
    | MethodDescriptorProto
    | undefined {
    if (descriptor instanceof FileDescriptorProto) {
      const packageName = descriptor.getPackage();

      const packagePrefix = packageName == null ? '' : `${packageName}.`;

      return (
        descriptor
          .getMessageTypeList()
          .find(type => findSymbol(symbol, type, packagePrefix)) ||
        descriptor
          .getEnumTypeList()
          .find(type => findSymbol(symbol, type, packagePrefix)) ||
        descriptor
          .getServiceList()
          .find(type => findSymbol(symbol, type, packagePrefix))
      );
    }

    const fullName = prefix + descriptor.getName();

    if (symbol === fullName) {
      return descriptor;
    }

    if (descriptor instanceof DescriptorProto) {
      const messagePrefix = `${fullName}.`;

      return (
        descriptor
          .getNestedTypeList()
          .find(type => findSymbol(symbol, type, messagePrefix)) ||
        descriptor
          .getEnumTypeList()
          .find(type => findSymbol(symbol, type, messagePrefix))
      );
    }

    if (descriptor instanceof ServiceDescriptorProto) {
      const servicePrefix = `${fullName}.`;

      return descriptor
        .getMethodList()
        .find(method => findSymbol(symbol, method, servicePrefix));
    }

    return undefined;
  }

  function handleRequest(
    request: ServerReflectionRequest,
  ): ServerReflectionResponse {
    switch (request.getMessageRequestCase()) {
      case ServerReflectionRequest.MessageRequestCase.FILE_BY_FILENAME: {
        const filename = request.getFileByFilename();

        const fileDescriptorProto = fileDescriptorSet
          .getFileList()
          .find(file => file.getName() === filename);

        if (fileDescriptorProto == null) {
          return new ServerReflectionResponse().setErrorResponse(
            new ErrorResponse()
              .setErrorCode(Status.NOT_FOUND)
              .setErrorMessage(`File not found: ${filename}`),
          );
        }

        return new ServerReflectionResponse()
          .setOriginalRequest(request)
          .setFileDescriptorResponse(
            new FileDescriptorResponse().setFileDescriptorProtoList([
              fileDescriptorProto.serializeBinary(),
            ]),
          );
      }

      case ServerReflectionRequest.MessageRequestCase.FILE_CONTAINING_SYMBOL: {
        const symbol = request.getFileContainingSymbol();

        const fileDescriptorProto = fileDescriptorSet
          .getFileList()
          .find(file => findSymbol(symbol, file) != null);

        if (fileDescriptorProto == null) {
          return new ServerReflectionResponse().setErrorResponse(
            new ErrorResponse()
              .setErrorCode(Status.NOT_FOUND)
              .setErrorMessage(`Symbol not found: ${symbol}`),
          );
        }

        return new ServerReflectionResponse()
          .setOriginalRequest(request)
          .setFileDescriptorResponse(
            new FileDescriptorResponse().setFileDescriptorProtoList([
              fileDescriptorProto.serializeBinary(),
            ]),
          );
      }

      case ServerReflectionRequest.MessageRequestCase
        .FILE_CONTAINING_EXTENSION: {
        const extensionRequest = request.getFileContainingExtension()!;
        const containingType = extensionRequest.getContainingType();
        const extensionNumber = extensionRequest.getExtensionNumber();

        const fileDescriptorProto = fileDescriptorSet
          .getFileList()
          .find(file => {
            const descriptor = findSymbol(containingType, file);

            return (
              descriptor instanceof DescriptorProto &&
              descriptor
                .getExtensionList()
                .some(extension => extensionNumber === extension.getNumber())
            );
          });

        if (fileDescriptorProto == null) {
          return new ServerReflectionResponse().setErrorResponse(
            new ErrorResponse()
              .setErrorCode(Status.NOT_FOUND)
              .setErrorMessage(
                `Extension not found: ${containingType}(${extensionNumber})`,
              ),
          );
        }

        return new ServerReflectionResponse()
          .setOriginalRequest(request)
          .setFileDescriptorResponse(
            new FileDescriptorResponse().setFileDescriptorProtoList([
              fileDescriptorProto.serializeBinary(),
            ]),
          );
      }

      case ServerReflectionRequest.MessageRequestCase.LIST_SERVICES: {
        return new ServerReflectionResponse()
          .setOriginalRequest(request)
          .setListServicesResponse(
            new ListServiceResponse().setServiceList(
              serviceNames.map(serviceName =>
                new ServiceResponse().setName(serviceName),
              ),
            ),
          );
      }

      case ServerReflectionRequest.MessageRequestCase
        .ALL_EXTENSION_NUMBERS_OF_TYPE: {
        const type = request.getAllExtensionNumbersOfType();

        return new ServerReflectionResponse().setAllExtensionNumbersResponse(
          new ExtensionNumberResponse().setBaseTypeName(type),
        );
      }
    }

    return new ServerReflectionResponse().setErrorResponse(
      new ErrorResponse()
        .setErrorCode(Status.UNIMPLEMENTED)
        .setErrorMessage('Not implemented'),
    );
  }

  return {
    async *serverReflectionInfo(
      requests: AsyncIterable<ServerReflectionRequest>,
    ): AsyncIterable<ServerReflectionResponse> {
      for await (const request of requests) {
        yield handleRequest(request);
      }
    },
  };
}
