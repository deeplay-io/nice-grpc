# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-common@2.0.0...nice-grpc-common@2.0.1) (2023-01-18)

**Note:** Version bump only for package nice-grpc-common

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-common@1.1.0...nice-grpc-common@2.0.0) (2022-08-11)

### ⚠ BREAKING CHANGES

- use built-in `AbortController` instead of `node-abort-controller` (#178)

### Features

- use built-in `AbortController` instead of `node-abort-controller`
  ([#178](https://github.com/deeplay-io/nice-grpc/issues/178))
  ([4c4bc4e](https://github.com/deeplay-io/nice-grpc/commit/4c4bc4eacf38bedfbcdd5a41f4471698f7a117ed)),
  closes [#158](https://github.com/deeplay-io/nice-grpc/issues/158)

## 1.1.0 (2022-04-18)

### Features

- **nice-grpc-common:** support extending `ServerError` and `ClientError`
  ([#119](https://github.com/deeplay-io/nice-grpc/issues/119))
  ([08887a8](https://github.com/deeplay-io/nice-grpc/commit/08887a82f081b1c52da74b39ca54ae053b4a21aa))

## 1.0.6 (2022-03-09)

### Bug Fixes

- **nice-grpc-common:** fix issues with `ServerError` and `ClientError` when
  transpiling to older environments
  ([#92](https://github.com/deeplay-io/nice-grpc/issues/92))
  ([8875aa8](https://github.com/deeplay-io/nice-grpc/commit/8875aa86bc505dfe0e347b4851e30114fa7dadc8))

## 1.0.5 (2022-03-05)

### Bug Fixes

- **nice-grpc-common:** fix issues with `ServerError` and `ClientError` when
  transpiling to older environments
  ([#88](https://github.com/deeplay-io/nice-grpc/issues/88))
  ([4bff076](https://github.com/deeplay-io/nice-grpc/commit/4bff076ebf49c41f88a4af570c9a04e7549b5719))

## 1.0.4 (2022-01-16)

### Bug Fixes

- **nice-grpc-common:** `ClientError` and `ServerError` now correctly work when
  transpiled to ES5 ([#34](https://github.com/deeplay-io/nice-grpc/issues/34))
  ([c8e095f](https://github.com/deeplay-io/nice-grpc/commit/c8e095f1f2d81d57b319714d88d9182cf301bcca))

## 1.0.3 (2021-09-21)

## 1.0.2 (2021-06-30)

### Bug Fixes

- **nice-grpc-common:** check availability of Error.captureStackTrace before
  using it ([#17](https://github.com/deeplay-io/nice-grpc/issues/17))
  ([358d18d](https://github.com/deeplay-io/nice-grpc/commit/358d18d7c6c8ee564a6035554b7cd131561e61e9))

## 1.0.1 (2021-06-29)

### Bug Fixes

- add missing `requestStream` and `responseStream` to `MethodDescriptor`
  ([2d92e40](https://github.com/deeplay-io/nice-grpc/commit/2d92e40564f646d80dccbde6e5cda6a8eadf4ba3))

## 1.0.0 (2021-06-29)
