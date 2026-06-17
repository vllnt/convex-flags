import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { mutation, query } from "./_generated/server.js";
import { Flags } from "../../src/client/index.js";
import {
  evalContext,
  evaluation,
  rollout,
  rule,
  variant,
  variantValue,
} from "../../src/component/validators.js";

/**
 * Host-app wrappers. The host owns auth: in a real app you would resolve and
 * check identity here before calling the management methods.
 */
const flags = new Flags(components.flags);

export const define = mutation({
  args: {
    key: v.string(),
    value: variantValue,
    description: v.optional(v.string()),
    variants: v.optional(v.array(variant)),
    rules: v.optional(v.array(rule)),
    rollout: v.optional(rollout),
  },
  returns: v.string(),
  handler: (ctx, args) => flags.define(ctx, args),
});

export const update = mutation({
  args: {
    key: v.string(),
    value: v.optional(variantValue),
    description: v.optional(v.string()),
    variants: v.optional(v.array(variant)),
    rules: v.optional(v.array(rule)),
    rollout: v.optional(rollout),
  },
  returns: v.null(),
  handler: (ctx, args) =>
    flags.update(ctx, args.key, {
      value: args.value,
      description: args.description,
      variants: args.variants,
      rules: args.rules,
      rollout: args.rollout,
    }),
});

export const enable = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: (ctx, args) => flags.enable(ctx, args.key),
});

export const disable = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: (ctx, args) => flags.disable(ctx, args.key),
});

export const archive = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: (ctx, args) => flags.archive(ctx, args.key),
});

export const restore = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: (ctx, args) => flags.restore(ctx, args.key),
});

export const remove = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: (ctx, args) => flags.remove(ctx, args.key),
});

export const setOverride = mutation({
  args: { key: v.string(), subjectRef: v.string(), value: variantValue },
  returns: v.null(),
  handler: (ctx, args) =>
    flags.setOverride(ctx, args.key, args.subjectRef, args.value),
});

export const clearOverride = mutation({
  args: { key: v.string(), subjectRef: v.string() },
  returns: v.null(),
  handler: (ctx, args) => flags.clearOverride(ctx, args.key, args.subjectRef),
});

export const get = query({
  args: { key: v.string() },
  returns: v.any(),
  handler: (ctx, args) => flags.get(ctx, args.key),
});

export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: (ctx) => flags.list(ctx),
});

export const evaluate = query({
  args: {
    key: v.string(),
    context: v.optional(evalContext),
    default: v.optional(variantValue),
  },
  returns: evaluation,
  handler: (ctx, args) =>
    flags.evaluate(ctx, args.key, {
      context: args.context,
      default: args.default,
    }),
});

export const variantOf = query({
  args: { key: v.string(), context: v.optional(evalContext) },
  returns: variantValue,
  handler: (ctx, args) => flags.variant(ctx, args.key, { context: args.context }),
});

export const isEnabled = query({
  args: { key: v.string(), context: v.optional(evalContext) },
  returns: v.boolean(),
  handler: (ctx, args) => flags.isEnabled(ctx, args.key, args.context),
});

export const all = query({
  args: { context: v.optional(evalContext) },
  returns: v.record(v.string(), evaluation),
  handler: (ctx, args) => flags.all(ctx, args.context),
});
