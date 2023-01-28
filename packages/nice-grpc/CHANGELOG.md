# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.1.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@2.0.1...nice-grpc@2.1.0) (2023-01-18)

### Features

- **nice-grpc:** include support for implicit secure protocol
  ([#271](https://github.com/deeplay-io/nice-grpc/issues/271))
  ([8d31462](https://github.com/deeplay-io/nice-grpc/commit/8d31462824caae66cd78d114c7606ed7489311d2))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@2.0.0...nice-grpc@2.0.1) (2022-11-02)

### Bug Fixes

- **nice-grpc:** fix server signal abort on call end
  ([#229](https://github.com/deeplay-io/nice-grpc/issues/229))
  ([04c1713](https://github.com/deeplay-io/nice-grpc/commit/04c1713759405566f58e836c8f33c31c83a7954d)),
  closes [#218](https://github.com/deeplay-io/nice-grpc/issues/218)

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.2.2...nice-grpc@2.0.0) (2022-08-11)

### ⚠ BREAKING CHANGES

- use built-in `AbortController` instead of `node-abort-controller` (#178)

### Features

- use built-in `AbortController` instead of `node-abort-controller`
  ([#178](https://github.com/deeplay-io/nice-grpc/issues/178))
  ([4c4bc4e](https://github.com/deeplay-io/nice-grpc/commit/4c4bc4eacf38bedfbcdd5a41f4471698f7a117ed)),
  closes [#158](https://github.com/deeplay-io/nice-grpc/issues/158)

## [1.2.2](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.2.1...nice-grpc@1.2.2) (2022-08-01)

### Bug Fixes

- **nice-grpc:** no longer reject unknown protocols in `createChannel`
  ([#168](https://github.com/deeplay-io/nice-grpc/issues/168))
  ([4d618fd](https://github.com/deeplay-io/nice-grpc/commit/4d618fdd349381318234f38ed69af49c64628b52)),
  closes [#167](https://github.com/deeplay-io/nice-grpc/issues/167)

## [1.2.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.2.0...nice-grpc@1.2.1) (2022-07-28)

### Bug Fixes

- **nice-grpc:** create `grpc-js` clients via `makeClientConstructor` for
  opentelemetry instrumentation
  ([bbcf52c](https://github.com/deeplay-io/nice-grpc/commit/bbcf52c9806eb2a46cd2ec14af770caa33c38e6f))

## [1.2.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.1.1...nice-grpc@1.2.0) (2022-05-04)

### Features

- add support for `ts-proto` server and client interfaces
  ([#126](https://github.com/deeplay-io/nice-grpc/issues/126))
  ([67f7eb6](https://github.com/deeplay-io/nice-grpc/commit/67f7eb613455426d6b63a4027132060a8a572f65)),
  closes [#115](https://github.com/deeplay-io/nice-grpc/issues/115)

## [1.1.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.1.0...nice-grpc@1.1.1) (2022-04-18)

## [1.1.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.8...nice-grpc@1.1.0) (2022-04-04)

### Features

- **nice-grpc:** upgrade `grpc-js` to `1.6.1`
  ([#111](https://github.com/deeplay-io/nice-grpc/issues/111))
  ([f8a25f8](https://github.com/deeplay-io/nice-grpc/commit/f8a25f899fe94150533c298a825e995ddea824f6))

## [1.0.8](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.7...nice-grpc@1.0.8) (2022-03-09)

## [1.0.7](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.6...nice-grpc@1.0.7) (2022-03-05)

## [1.0.6](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.5...nice-grpc@1.0.6) (2022-01-16)

## [1.0.5](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.4...nice-grpc@1.0.5) (2022-01-16)

### Bug Fixes

- **nice-grpc:** fix import of `ConnectivityState` from `grpc-js`
  ([#33](https://github.com/deeplay-io/nice-grpc/issues/33))
  ([380bb7f](https://github.com/deeplay-io/nice-grpc/commit/380bb7fd31265dcef7e01dfb1715a6ccb1bd363e))

## [1.0.4](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.3...nice-grpc@1.0.4) (2021-09-21)

## [1.0.3](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.2...nice-grpc@1.0.3) (2021-07-01)

### Bug Fixes

- **nice-grpc:** add missing re-exports of Channel and ChannelOptions from
  `@grpc/grpc-js`
  ([d7c1ac1](https://github.com/deeplay-io/nice-grpc/commit/d7c1ac19b5f2a3c56515157e35a01b63469ea7cf))

## [1.0.2](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.1...nice-grpc@1.0.2) (2021-06-30)

## [1.0.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc@1.0.0...nice-grpc@1.0.1) (2021-06-29)

### Bug Fixes

- add missing `requestStream` and `responseStream` to `MethodDescriptor`
  ([2d92e40](https://github.com/deeplay-io/nice-grpc/commit/2d92e40564f646d80dccbde6e5cda6a8eadf4ba3))

## [1.0.0](https://github.com/deeplay-io/nice-grpc/compare/79ec8f8c7c1df9d6d5df4f268acef9c86de766c9...nice-grpc@1.0.0) (2021-06-29)

### ⚠ BREAKING CHANGES

- **nice-grpc:** APIs now use `nice-grpc-common` instead of `grpc-js`

* `grpc-js#Metadata` replaced with `nice-grpc-common#Metadata`.
* `grpc-js#status` replaced with `nice-grpc-common#Status`.
* Server middleware `call.definition` replaced with `call.method` containing a
  universal method descriptor.
* Built-in deadline support was removed in favor of a separate deadline client
  middleware.

### Features

- **nice-grpc:** support `ts-proto` service definitions
  ([#14](https://github.com/deeplay-io/nice-grpc/issues/14))
  ([1852519](https://github.com/deeplay-io/nice-grpc/commit/1852519dd8cdb7f616a5a2a14bb45d8902c171c3))

### Code Refactoring

- **nice-grpc:** migrate to `nice-grpc-common`
  ([#12](https://github.com/deeplay-io/nice-grpc/issues/12))
  ([79ec8f8](https://github.com/deeplay-io/nice-grpc/commit/79ec8f8c7c1df9d6d5df4f268acef9c86de766c9))
