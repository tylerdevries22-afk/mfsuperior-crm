/**
 * Composition root for the operations API client. Timeout and retry policy is
 * owned by `createResilientFetch` in `./retry` and wired in `./ApiClientCore`;
 * this file pins the public surface so consumers keep one stable import path.
 */
export { ApiClient } from "./ApiClientCore";
export type {
  ApiClientOptions,
  ApiHttpMethod,
  ApiRequestOptions,
  NetworkLogContext,
  NetworkLogger,
} from "./api-request-types";
