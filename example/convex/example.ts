import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { mutation, query } from "./_generated/server.js";
import { Flags } from "../../src/client/index.js";

/**
 * Host-app wrappers. The host owns auth: in a real app you would resolve and
 * check identity here before calling the management methods.
 */
const flags = new Flags(components.flags);

export const define = mutation({
  args: {
    key: v.string(),
    value: v.boolean(),
    description: v.optional(v.string()),
  },
  returns: v.string(),
  handler: (ctx, args) => flags.define(ctx, args),
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

export const remove = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: (ctx, args) => flags.remove(ctx, args.key),
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
  args: { key: v.string() },
  returns: v.object({ value: v.boolean(), reason: v.string() }),
  handler: (ctx, args) => flags.evaluate(ctx, args.key),
});

export const isEnabled = query({
  args: { key: v.string() },
  returns: v.boolean(),
  handler: (ctx, args) => flags.isEnabled(ctx, args.key),
});

export const all = query({
  args: {},
  returns: v.record(v.string(), v.object({ value: v.boolean(), reason: v.string() })),
  handler: (ctx) => flags.all(ctx),
});
