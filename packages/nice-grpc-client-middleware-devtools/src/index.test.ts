import defer = require('defer-promise');
import {forever} from 'abort-controller-x';
import {
  createChannel,
  createClientFactory,
  createServer,
  ServerError,
  Status,
} from 'nice-grpc';
import {devtoolsLoggingMiddleware} from '.';
import {TestService} from '../fixtures/test_grpc_pb';
import {TestRequest, TestResponse} from '../fixtures/test_pb';

// TODO: Can this middleware be tested?