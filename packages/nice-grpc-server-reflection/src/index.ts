import {ServiceImplementation, Status} from 'nice-grpc';
import {
  DescriptorProto,
  EnumDescriptorProto,
  FileDescriptorProto,
  FileDescriptorSet,
  MethodDescriptorProto,
  ServiceDescriptorProto,
} from 'ts-proto-descriptors';
import {
  DeepPartial,
  ServerReflectionDefinition,
  ServerReflectionRequest,
  ServerReflectionResponse,
} from './proto/grpc/reflection/v1alpha/reflection';

export {ServerReflectionDefinition};

type FileDescriptor = {type: 'file'; value: FileDescriptorProto};
type MessageDescriptor = {type: 'message'; value: DescriptorProto};
type EnumDescriptor = {type: 'enum'; value: EnumDescriptorProto};
type ServiceDescriptor = {type: 'service'; value: ServiceDescriptorProto};
type MethodDescriptor = {type: 'method'; value: MethodDescriptorProto};

export function ServerReflection(
  protoset: Uint8Array,
  serviceNames: string[],
): ServiceImplementation<typeof ServerReflectionDefinition> {
  const fileDescriptorSet = FileDescriptorSet.decode(protoset);

  function findSymbol(
    symbol: string,
    descriptor:
      | FileDescriptor
      | MessageDescriptor
      | EnumDescriptor
      | ServiceDescriptor
      | MethodDescriptor,
    prefix: string = '',
  ):
    | MessageDescriptor
    | EnumDescriptor
    | ServiceDescriptor
    | MethodDescriptor
    | undefined {
    if (descriptor.type === 'file') {
      const packageName = descriptor.value.package;

      const packagePrefix = packageName == null ? '' : `${packageName}.`;

      const messageValue = descriptor.value.messageType.find(value =>
        findSymbol(symbol, {type: 'message', value}, packagePrefix),
      );

      if (messageValue != null) {
        return {type: 'message', value: messageValue};
      }

      const enumValue = descriptor.value.enumType.find(value =>
        findSymbol(symbol, {type: 'enum', value}, packagePrefix),
      );

      if (enumValue != null) {
        return {type: 'enum', value: enumValue};
      }

      const serviceValue = descriptor.value.service.find(value =>
        findSymbol(symbol, {type: 'service', value}, packagePrefix),
      );

      if (serviceValue != null) {
        return {type: 'service', value: serviceValue};
      }

      return undefined;
    }

    const fullName = prefix + descriptor.value.name;

    if (symbol === fullName) {
      return descriptor;
    }

    if (descriptor.type === 'message') {
      const messagePrefix = `${fullName}.`;

      const messageValue = descriptor.value.nestedType.find(value =>
        findSymbol(symbol, {type: 'message', value}, messagePrefix),
      );

      if (messageValue != null) {
        return {type: 'message', value: messageValue};
      }

      const enumValue = descriptor.value.enumType.find(value =>
        findSymbol(symbol, {type: 'enum', value}, messagePrefix),
      );

      if (enumValue != null) {
        return {type: 'enum', value: enumValue};
      }

      return undefined;
    }

    if (descriptor.type === 'service') {
      const servicePrefix = `${fullName}`;

      const methodValue = descriptor.value.method.find(value =>
        findSymbol(symbol, {type: 'method', value}, servicePrefix),
      );

      if (methodValue != null) {
        return {type: 'method', value: methodValue};
      }

      return undefined;
    }

    return undefined;
  }

  function handleRequest(
    request: ServerReflectionRequest,
  ): DeepPartial<ServerReflectionResponse> {
    switch (request.messageRequest?.$case) {
      case 'fileByFilename': {
        const filename = request.messageRequest.fileByFilename;

        const fileDescriptorProto = fileDescriptorSet.file.find(
          file => file.name === filename,
        );

        if (fileDescriptorProto == null) {
          return {
            originalRequest: request,
            messageResponse: {
              $case: 'errorResponse',
              errorResponse: {
                errorCode: Status.NOT_FOUND,
                errorMessage: `File not found: ${filename}`,
              },
            },
          };
        }

        return {
          originalRequest: request,
          messageResponse: {
            $case: 'fileDescriptorResponse',
            fileDescriptorResponse: {
              fileDescriptorProto: [
                FileDescriptorProto.encode(fileDescriptorProto).finish(),
              ],
            },
          },
        };
      }

      case 'fileContainingSymbol': {
        const symbol = request.messageRequest.fileContainingSymbol;

        const fileDescriptorProto = fileDescriptorSet.file.find(
          value => findSymbol(symbol, {type: 'file', value}) != null,
        );

        if (fileDescriptorProto == null) {
          return {
            originalRequest: request,
            messageResponse: {
              $case: 'errorResponse',
              errorResponse: {
                errorCode: Status.NOT_FOUND,
                errorMessage: `Symbol not found: ${symbol}`,
              },
            },
          };
        }

        return {
          originalRequest: request,
          messageResponse: {
            $case: 'fileDescriptorResponse',
            fileDescriptorResponse: {
              fileDescriptorProto: [
                FileDescriptorProto.encode(fileDescriptorProto).finish(),
              ],
            },
          },
        };
      }

      case 'fileContainingExtension': {
        const {containingType, extensionNumber} =
          request.messageRequest.fileContainingExtension;

        const fileDescriptorProto = fileDescriptorSet.file.find(value => {
          const descriptor = findSymbol(containingType, {type: 'file', value});

          return (
            descriptor?.type === 'message' &&
            descriptor.value.extension.some(
              extension => extensionNumber === extension.number,
            )
          );
        });

        if (fileDescriptorProto == null) {
          return {
            originalRequest: request,
            messageResponse: {
              $case: 'errorResponse',
              errorResponse: {
                errorCode: Status.NOT_FOUND,
                errorMessage: `Extension not found: ${containingType}(${extensionNumber})`,
              },
            },
          };
        }

        return {
          originalRequest: request,
          messageResponse: {
            $case: 'fileDescriptorResponse',
            fileDescriptorResponse: {
              fileDescriptorProto: [
                FileDescriptorProto.encode(fileDescriptorProto).finish(),
              ],
            },
          },
        };
      }

      case 'listServices': {
        return {
          originalRequest: request,
          messageResponse: {
            $case: 'listServicesResponse',
            listServicesResponse: {
              service: serviceNames.map(serviceName => ({name: serviceName})),
            },
          },
        };
      }
    }

    return {
      originalRequest: request,
      messageResponse: {
        $case: 'errorResponse',
        errorResponse: {
          errorCode: Status.UNIMPLEMENTED,
          errorMessage: 'Not implemented',
        },
      },
    };
  }

  return {
    async *serverReflectionInfo(
      requests: AsyncIterable<ServerReflectionRequest>,
    ): AsyncIterable<DeepPartial<ServerReflectionResponse>> {
      for await (const request of requests) {
        yield handleRequest(request);
      }
    },
  };
}
