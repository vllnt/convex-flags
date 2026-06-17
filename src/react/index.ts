/**
 * Optional React layer for `@vllnt/convex-flags`.
 *
 * Thin, tree-shakeable hooks over `convex/react`'s `useQuery`. They wrap the
 * host's own re-exported `evaluate` / `all` query refs — the component never
 * owns the host's `api`. `react` and `convex/react` are optional peer deps: a
 * backend-only consumer never imports this entry and pulls in zero React.
 *
 * @example
 * ```tsx
 * // convex/flags.ts (host) re-exports the query refs from its wrappers, then:
 * const evaluation = useFlag(api.flags.evaluate, "new-checkout", { context: { subjectRef } });
 * if (evaluation?.value === true) { ... }
 * ```
 */
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import type { EvalContext, FlagEvaluation, VariantValue } from "../shared.js";

/** The host's re-exported `evaluate` query reference. */
export type EvaluateRef = FunctionReference<
  "query",
  "public",
  { key: string; context?: EvalContext; default?: VariantValue },
  FlagEvaluation
>;

/** The host's re-exported `all` query reference. */
export type AllRef = FunctionReference<
  "query",
  "public",
  { context?: EvalContext },
  Record<string, FlagEvaluation>
>;

/** Options for {@link useFlag}. */
export interface UseFlagOptions {
  context?: EvalContext;
  default?: VariantValue;
}

/**
 * Reactively evaluate a single flag. Returns `undefined` while the query loads,
 * then the {@link FlagEvaluation}. Re-renders whenever the flag changes.
 */
export function useFlag(
  query: EvaluateRef,
  key: string,
  options?: UseFlagOptions,
): FlagEvaluation | undefined {
  return useQuery(query, {
    key,
    context: options?.context,
    default: options?.default,
  });
}

/**
 * Reactively evaluate every flag against optional context. Returns `undefined`
 * while loading, then a map of flag key → {@link FlagEvaluation}.
 */
export function useFlags(
  query: AllRef,
  context?: EvalContext,
): Record<string, FlagEvaluation> | undefined {
  return useQuery(query, { context });
}

export type { EvalContext, FlagEvaluation, VariantValue };
