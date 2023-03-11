# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.1.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.1.0...nice-grpc-web@3.1.1) (2023-03-11)

**Note:** Version bump only for package nice-grpc-web

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.1.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.0.0...nice-grpc-web@3.1.0) (2023-03-08)

### Features

- **nice-grpc-web:** add FetchTransportConfig to support credentials in
  FetchTransport ([#313](https://github.com/deeplay-io/nice-grpc/issues/313))
  ([c531c95](https://github.com/deeplay-io/nice-grpc/commit/c531c9538c7eee13eb07f2a852ac2ddce10a76a4)),
  closes [#312](https://github.com/deeplay-io/nice-grpc/issues/312)

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.0.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@2.0.2...nice-grpc-web@3.0.0) (2023-03-05)

### ⚠ BREAKING CHANGES

- `@improbable-eng/grpc-web` transports are replaced by built-in analogs

- feat!(nice-grpc-web): rewrite from scratch, removing
  `@improbable-eng/grpc-web` dependency (#274)
  ([82881b7](https://github.com/deeplay-io/nice-grpc/commit/82881b7eebdf143a5ad088289690b6d6581cfb64)),
  closes [#274](https://github.com/deeplay-io/nice-grpc/issues/274)
  [#199](https://github.com/deeplay-io/nice-grpc/issues/199)
  [#226](https://github.com/deeplay-io/nice-grpc/issues/226)
  [#232](https://github.com/deeplay-io/nice-grpc/issues/232)
  [#246](https://github.com/deeplay-io/nice-grpc/issues/246)

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.2](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@2.0.1...nice-grpc-web@2.0.2) (2023-01-18)

### Bug Fixes

- **nice-grpc-web:** split joined binary metadata into multiple values
  ([#248](https://github.com/deeplay-io/nice-grpc/issues/248))
  ([8da7de8](https://github.com/deeplay-io/nice-grpc/commit/8da7de87ba6dba505b3564444f9ff061237f4e9a))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@2.0.0...nice-grpc-web@2.0.1) (2022-11-02)

**Note:** Version bump only for package nice-grpc-web

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@1.1.0...nice-grpc-web@2.0.0) (2022-08-11)

### ⚠ BREAKING CHANGES

- use built-in `AbortController` instead of `node-abort-controller` (#178)

### Features

- use built-in `AbortController` instead of `node-abort-controller`
  ([#178](https://github.com/deeplay-io/nice-grpc/issues/178))
  ([4c4bc4e](https://github.com/deeplay-io/nice-grpc/commit/4c4bc4eacf38bedfbcdd5a41f4471698f7a117ed)),
  closes [#158](https://github.com/deeplay-io/nice-grpc/issues/158)

## 1.1.0 (2022-05-04)

### Features

- add support for `ts-proto` server and client interfaces
  ([#126](https://github.com/deeplay-io/nice-grpc/issues/126))
  ([67f7eb6](https://github.com/deeplay-io/nice-grpc/commit/67f7eb613455426d6b63a4027132060a8a572f65)),
  closes [#115](https://github.com/deeplay-io/nice-grpc/issues/115)

## 1.0.8 (2022-04-18)

## 1.0.7 (2022-03-09)

## 1.0.6 (2022-03-05)

## 1.0.5 (2022-01-16)

## 1.0.4 (2022-01-16)

## 1.0.3 (2021-09-21)

## 1.0.2 (2021-06-30)

## 1.0.1 (2021-06-29)

### Bug Fixes

- add missing `requestStream` and `responseStream` to `MethodDescriptor`
  ([2d92e40](https://github.com/deeplay-io/nice-grpc/commit/2d92e40564f646d80dccbde6e5cda6a8eadf4ba3))

## 1.0.0 (2021-06-29)

### Features

- **nice-grpc-web:** support `ts-proto` service definitions
  ([#15](https://github.com/deeplay-io/nice-grpc/issues/15))
  ([53a4861](https://github.com/deeplay-io/nice-grpc/commit/53a48610ce92263963882a68ef47bdf5ed26190c))
