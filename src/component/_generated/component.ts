/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

type FlagDoc = {
  _id: string;
  _creationTime: number;
  key: string;
  description?: string;
  value: boolean;
  createdAt: number;
  updatedAt: number;
};

type FlagEvaluation = { value: boolean; reason: string };

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.flags`.
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    mutations: {
      define: FunctionReference<
        "mutation",
        "internal",
        { key: string; value: boolean; description?: string },
        string,
        Name
      >;
      enable: FunctionReference<"mutation", "internal", { key: string }, null, Name>;
      disable: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        null,
        Name
      >;
      remove: FunctionReference<"mutation", "internal", { key: string }, null, Name>;
    };
    queries: {
      get: FunctionReference<
        "query",
        "internal",
        { key: string },
        FlagDoc | null,
        Name
      >;
      list: FunctionReference<"query", "internal", {}, Array<FlagDoc>, Name>;
      evaluate: FunctionReference<
        "query",
        "internal",
        { key: string },
        FlagEvaluation,
        Name
      >;
      all: FunctionReference<
        "query",
        "internal",
        {},
        Record<string, FlagEvaluation>,
        Name
      >;
    };
  };
