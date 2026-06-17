import { v } from "convex/values";
import { query } from "./_generated/server.js";
import type { Doc } from "./_generated/dataModel.js";
import type { QueryCtx } from "./_generated/server.js";
import { evalContext, evaluation, flagDoc, variantValue } from "./validators.js";
import {
  EVAL_REASON,
  evaluateFlag,
  type EvalContext,
  type FlagEvaluation,
  type VariantValue,
} from "../shared.js";

/** Resolve a single flag: a per-subject override wins, otherwise the engine. */
async function resolve(
  ctx: QueryCtx,
  flag: Doc<"flags">,
  context: EvalContext,
): Promise<FlagEvaluation> {
  const subjectRef = context.subjectRef;
  if (subjectRef !== undefined) {
    const override = await ctx.db
      .query("overrides")
      .withIndex("by_key_subject", (q) =>
        q.eq("key", flag.key).eq("subjectRef", subjectRef),
      )
      .unique();
    if (override !== null) {
      return { value: override.value, reason: EVAL_REASON.override };
    }
  }
  return evaluateFlag(flag.key, flag, context);
}

/** Fetch a single flag definition by key. */
export const get = query({
  args: { key: v.string() },
  returns: v.union(v.null(), flagDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
  },
});

/** List every flag definition. */
export const list = query({
  args: {},
  returns: v.array(flagDoc),
  handler: async (ctx) => {
    return await ctx.db.query("flags").collect();
  },
});

/**
 * Evaluate one flag against optional context. Resolution order: per-subject
 * override → archived → targeting rules → fallthrough rollout → flag value. An
 * unknown key serves the caller `default` (reason `default`) or `false`
 * (reason `unknown`).
 */
export const evaluate = query({
  args: {
    key: v.string(),
    context: v.optional(evalContext),
    default: v.optional(variantValue),
  },
  returns: evaluation,
  handler: async (ctx, args): Promise<FlagEvaluation> => {
    const flag = await ctx.db
      .query("flags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (flag === null) {
      return args.default !== undefined
        ? { value: args.default, reason: EVAL_REASON.default }
        : { value: false, reason: EVAL_REASON.unknown };
    }
    return await resolve(ctx, flag, args.context ?? {});
  },
});

/**
 * Evaluate every flag at once against optional context — the bootstrap payload
 * for a reactive client. Per-subject overrides for the context's `subjectRef`
 * are applied (loaded in a single query, never inside the loop).
 */
export const all = query({
  args: { context: v.optional(evalContext) },
  returns: v.record(v.string(), evaluation),
  handler: async (ctx, args) => {
    const context = args.context ?? {};
    const flags = await ctx.db.query("flags").collect();
    const overrideValues: Record<string, VariantValue> = {};
    const subjectRef = context.subjectRef;
    if (subjectRef !== undefined) {
      const overrides = await ctx.db
        .query("overrides")
        .withIndex("by_subject", (q) => q.eq("subjectRef", subjectRef))
        .collect();
      for (const override of overrides) {
        overrideValues[override.key] = override.value;
      }
    }
    const result: Record<string, FlagEvaluation> = {};
    for (const flag of flags) {
      const overridden = overrideValues[flag.key];
      result[flag.key] =
        overridden !== undefined
          ? { value: overridden, reason: EVAL_REASON.override }
          : evaluateFlag(flag.key, flag, context);
    }
    return result;
  },
});
