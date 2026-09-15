/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as data_dataset from "../data/dataset.js";
import type * as http from "../http.js";
import type * as integration_adapters from "../integration/adapters.js";
import type * as integration_canonical from "../integration/canonical.js";
import type * as integration_mediator from "../integration/mediator.js";
import type * as integration_schemaMatching from "../integration/schemaMatching.js";
import type * as registry from "../registry.js";
import type * as runs from "../runs.js";
import type * as seed from "../seed.js";
import type * as sources_api from "../sources/api.js";
import type * as sources_readers from "../sources/readers.js";
import type * as users from "../users.js";
import type * as verify from "../verify.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  "data/dataset": typeof data_dataset;
  http: typeof http;
  "integration/adapters": typeof integration_adapters;
  "integration/canonical": typeof integration_canonical;
  "integration/mediator": typeof integration_mediator;
  "integration/schemaMatching": typeof integration_schemaMatching;
  registry: typeof registry;
  runs: typeof runs;
  seed: typeof seed;
  "sources/api": typeof sources_api;
  "sources/readers": typeof sources_readers;
  users: typeof users;
  verify: typeof verify;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
