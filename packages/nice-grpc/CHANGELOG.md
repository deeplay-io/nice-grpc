# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.0...nice-grpc@1.0.1) (2021-06-29)


### Bug Fixes

* add missing `requestStream` and `responseStream` to `MethodDescriptor` ([2d92e40](https://github.com/deeplay-io/nice-grpc/commit/2d92e40564f646d80dccbde6e5cda6a8eadf4ba3))





# 1.0.0 (2021-06-29)


### Code Refactoring

* **nice-grpc:** migrate to `nice-grpc-common` ([#12](https://github.com/deeplay-io/nice-grpc/issues/12)) ([79ec8f8](https://github.com/deeplay-io/nice-grpc/commit/79ec8f8c7c1df9d6d5df4f268acef9c86de766c9))


### Features

* **nice-grpc:** support `ts-proto` service definitions ([#14](https://github.com/deeplay-io/nice-grpc/issues/14)) ([1852519](https://github.com/deeplay-io/nice-grpc/commit/1852519dd8cdb7f616a5a2a14bb45d8902c171c3))


### BREAKING CHANGES

* **nice-grpc:** APIs now use `nice-grpc-common` instead of `grpc-js`

- `grpc-js#Metadata` replaced with `nice-grpc-common#Metadata`.
- `grpc-js#status` replaced with `nice-grpc-common#Status`.
- Server middleware `call.definition` replaced with `call.method` containing a universal method descriptor.
- Built-in deadline support was removed in favor of a separate deadline client middleware.
