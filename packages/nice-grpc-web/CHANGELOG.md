# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## <small>3.3.2 (2023-10-17)</small>

- chore: fix hanging and erroring tests (#466)
  ([0d169ec](https://github.com/deeplay-io/nice-grpc/commit/0d169ec)), closes
  [#466](https://github.com/deeplay-io/nice-grpc/issues/466)
- chore(deps-dev): bump jasmine and @types/jasmine (#464)
  ([deb51bc](https://github.com/deeplay-io/nice-grpc/commit/deb51bc)), closes
  [#464](https://github.com/deeplay-io/nice-grpc/issues/464)
- chore(deps-dev): upgrade mkdirp to 3.0.1 (#463)
  ([02772e8](https://github.com/deeplay-io/nice-grpc/commit/02772e8)), closes
  [#463](https://github.com/deeplay-io/nice-grpc/issues/463)
- chore(nice-grpc-web): fix failing tests (#467)
  ([0509986](https://github.com/deeplay-io/nice-grpc/commit/0509986)), closes
  [#467](https://github.com/deeplay-io/nice-grpc/issues/467)
- chore(nice-grpc-web): update error message
  ([226b599](https://github.com/deeplay-io/nice-grpc/commit/226b599)), closes
  [#446](https://github.com/deeplay-io/nice-grpc/issues/446)

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.3.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.3.0...nice-grpc-web@3.3.1) (2023-07-16)

### Bug Fixes

- **nice-grpc-web:** don't put stack traces to internal and transport error
  messages ([#406](https://github.com/deeplay-io/nice-grpc/issues/406))
  ([27c6230](https://github.com/deeplay-io/nice-grpc/commit/27c6230eae74cac04223bf536c609e9dcc7d32de)),
  closes [#386](https://github.com/deeplay-io/nice-grpc/issues/386)

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.3.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.2.4...nice-grpc-web@3.3.0) (2023-05-02)

### Features

- **nice-grpc-web:** add `cache` field to FetchTransportConfig
  ([#350](https://github.com/deeplay-io/nice-grpc/issues/350))
  ([19533cd](https://github.com/deeplay-io/nice-grpc/commit/19533cd11df338dd1d1c97948bac35348e3eb9a5))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.2.4](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.2.3...nice-grpc-web@3.2.4) (2023-04-18)

### Bug Fixes

- **nice-grpc-web:** correctly handle trailers-only responses
  ([#347](https://github.com/deeplay-io/nice-grpc/issues/347))
  ([2beeafc](https://github.com/deeplay-io/nice-grpc/commit/2beeafcd63ccd7bb0d32755d6680f400a94fb984)),
  closes [#345](https://github.com/deeplay-io/nice-grpc/issues/345)

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.2.3](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.2.2...nice-grpc-web@3.2.3) (2023-03-31)

**Note:** Version bump only for package nice-grpc-web

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.2.2](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.2.1...nice-grpc-web@3.2.2) (2023-03-28)

### Bug Fixes

- **nice-grpc-web:** return `UNKNOWN` status on transport errors
  ([#326](https://github.com/deeplay-io/nice-grpc/issues/326))
  ([a0e1b31](https://github.com/deeplay-io/nice-grpc/commit/a0e1b316df8a578078b06f676780618d27c9e5f9))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.2.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.2.0...nice-grpc-web@3.2.1) (2023-03-28)

### Bug Fixes

- **nice-grpc-web:** fix delayed empty emissions in server stream
  ([#325](https://github.com/deeplay-io/nice-grpc/issues/325))
  ([4b3bf1c](https://github.com/deeplay-io/nice-grpc/commit/4b3bf1c0a7d111d27f7fbee25a0abafdb9ec47a1))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.2.0](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.1.0...nice-grpc-web@3.2.0) (2023-03-25)

### Features

- **nice-grpc-web:** add new `NodeHttpTransport` based on NodeJS `http` module
  ([#324](https://github.com/deeplay-io/nice-grpc/issues/324))
  ([6e1a1d3](https://github.com/deeplay-io/nice-grpc/commit/6e1a1d3abfc00cb1968f8ea393a23bd22f93885c))

### Bug Fixes

- support unknown options in ts-proto method definitions
  ([#323](https://github.com/deeplay-io/nice-grpc/issues/323))
  ([dadeb0a](https://github.com/deeplay-io/nice-grpc/commit/dadeb0aff28b1bf686f2e1f8403b7abb42440816))

# Change Log

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.1.1](https://github.com/deeplay-io/nice-grpc/compare/nice-grpc-web@3.1.0...nice-grpc-web@3.1.1) (2023-03-21)

### Bug Fixes

- support unknown options in ts-proto method definitions
  ([#323](https://github.com/deeplay-io/nice-grpc/issues/323))
  ([dadeb0a](https://github.com/deeplay-io/nice-grpc/commit/dadeb0aff28b1bf686f2e1f8403b7abb42440816))

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
