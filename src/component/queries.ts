import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { evaluation, flagDoc } from "./validators.js";
import { EVAL_REASON, type FlagEvaluation } from "../shared.js";

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

/** Evaluate one flag, returning its value and the reason it was served. */
export const evaluate = query({
  args: { key: v.string() },
  returns: evaluation,
  handler: async (ctx, args): Promise<FlagEvaluation> => {
    const flag = await ctx.db
      .query("flags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (flag === null) {
      return { value: false, reason: EVAL_REASON.unknown };
    }
    return { value: flag.value, reason: EVAL_REASON.flag };
  },
});

/** Evaluate every flag at once — the bootstrap payload for a reactive client. */
export const all = query({
  args: {},
  returns: v.record(v.string(), evaluation),
  handler: async (ctx) => {
    const flags = await ctx.db.query("flags").collect();
    const result: Record<string, FlagEvaluation> = {};
    for (const flag of flags) {
      result[flag.key] = { value: flag.value, reason: EVAL_REASON.flag };
    }
    return result;
  },
});
