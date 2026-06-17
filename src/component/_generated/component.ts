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

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    mutations: {
      archive: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        null,
        Name
      >;
      clearOverride: FunctionReference<
        "mutation",
        "internal",
        { key: string; subjectRef: string },
        null,
        Name
      >;
      define: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          key: string;
          rollout?: {
            by?: string;
            splits: Array<{ value: boolean | string | number; weight: number }>;
          };
          rules?: Array<{
            conditions: Array<{
              attribute: string;
              op:
                | "eq"
                | "neq"
                | "in"
                | "nin"
                | "contains"
                | "gt"
                | "gte"
                | "lt"
                | "lte";
              values: Array<boolean | string | number>;
            }>;
            rollout?: {
              by?: string;
              splits: Array<{
                value: boolean | string | number;
                weight: number;
              }>;
            };
            value?: boolean | string | number;
          }>;
          value: boolean | string | number;
          variants?: Array<{
            label?: string;
            value: boolean | string | number;
          }>;
        },
        string,
        Name
      >;
      disable: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        null,
        Name
      >;
      enable: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        null,
        Name
      >;
      remove: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        null,
        Name
      >;
      restore: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        null,
        Name
      >;
      setOverride: FunctionReference<
        "mutation",
        "internal",
        { key: string; subjectRef: string; value: boolean | string | number },
        null,
        Name
      >;
      update: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          key: string;
          rollout?: {
            by?: string;
            splits: Array<{ value: boolean | string | number; weight: number }>;
          };
          rules?: Array<{
            conditions: Array<{
              attribute: string;
              op:
                | "eq"
                | "neq"
                | "in"
                | "nin"
                | "contains"
                | "gt"
                | "gte"
                | "lt"
                | "lte";
              values: Array<boolean | string | number>;
            }>;
            rollout?: {
              by?: string;
              splits: Array<{
                value: boolean | string | number;
                weight: number;
              }>;
            };
            value?: boolean | string | number;
          }>;
          value?: boolean | string | number;
          variants?: Array<{
            label?: string;
            value: boolean | string | number;
          }>;
        },
        null,
        Name
      >;
    };
    queries: {
      all: FunctionReference<
        "query",
        "internal",
        {
          context?: {
            attributes?: Record<string, boolean | string | number>;
            subjectRef?: string;
          };
        },
        Record<
          string,
          {
            reason:
              | "flag"
              | "rule"
              | "rollout"
              | "override"
              | "disabled"
              | "default"
              | "unknown";
            value: boolean | string | number;
          }
        >,
        Name
      >;
      evaluate: FunctionReference<
        "query",
        "internal",
        {
          context?: {
            attributes?: Record<string, boolean | string | number>;
            subjectRef?: string;
          };
          default?: boolean | string | number;
          key: string;
        },
        {
          reason:
            | "flag"
            | "rule"
            | "rollout"
            | "override"
            | "disabled"
            | "default"
            | "unknown";
          value: boolean | string | number;
        },
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          description?: string;
          key: string;
          rollout?: {
            by?: string;
            splits: Array<{ value: boolean | string | number; weight: number }>;
          };
          rules?: Array<{
            conditions: Array<{
              attribute: string;
              op:
                | "eq"
                | "neq"
                | "in"
                | "nin"
                | "contains"
                | "gt"
                | "gte"
                | "lt"
                | "lte";
              values: Array<boolean | string | number>;
            }>;
            rollout?: {
              by?: string;
              splits: Array<{
                value: boolean | string | number;
                weight: number;
              }>;
            };
            value?: boolean | string | number;
          }>;
          status: "active" | "archived";
          updatedAt: number;
          value: boolean | string | number;
          variants?: Array<{
            label?: string;
            value: boolean | string | number;
          }>;
        },
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          description?: string;
          key: string;
          rollout?: {
            by?: string;
            splits: Array<{ value: boolean | string | number; weight: number }>;
          };
          rules?: Array<{
            conditions: Array<{
              attribute: string;
              op:
                | "eq"
                | "neq"
                | "in"
                | "nin"
                | "contains"
                | "gt"
                | "gte"
                | "lt"
                | "lte";
              values: Array<boolean | string | number>;
            }>;
            rollout?: {
              by?: string;
              splits: Array<{
                value: boolean | string | number;
                weight: number;
              }>;
            };
            value?: boolean | string | number;
          }>;
          status: "active" | "archived";
          updatedAt: number;
          value: boolean | string | number;
          variants?: Array<{
            label?: string;
            value: boolean | string | number;
          }>;
        }>,
        Name
      >;
    };
  };
