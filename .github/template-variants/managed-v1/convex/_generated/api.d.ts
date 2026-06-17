/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessAdmin from "../accessAdmin.js";
import type * as accessOrg from "../accessOrg.js";
import type * as accessOrgAdmin from "../accessOrgAdmin.js";
import type * as accessUser from "../accessUser.js";
import type * as hercules from "../hercules.js";
import type * as http from "../http.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessAdmin: typeof accessAdmin;
  accessOrg: typeof accessOrg;
  accessOrgAdmin: typeof accessOrgAdmin;
  accessUser: typeof accessUser;
  hercules: typeof hercules;
  http: typeof http;
  users: typeof users;
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

export declare const components: {
  hercules: import("@usehercules/convex/_generated/component.js").ComponentApi<"hercules">;
};
