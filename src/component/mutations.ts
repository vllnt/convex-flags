import { v } from "convex/values";
import { mutation } from "./_generated/server.js";
import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";

async function findByKey(
  ctx: MutationCtx,
  key: string,
): Promise<Doc<"flags"> | null> {
  return await ctx.db
    .query("flags")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

/** Create a flag, or update its value/description if the key already exists. */
export const define = mutation({
  args: {
    key: v.string(),
    value: v.boolean(),
    description: v.optional(v.string()),
  },
  returns: v.id("flags"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await findByKey(ctx, args.key);
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("flags", {
      key: args.key,
      value: args.value,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });
  },
});

async function setValue(
  ctx: MutationCtx,
  key: string,
  value: boolean,
): Promise<void> {
  const flag = await findByKey(ctx, key);
  if (flag === null) {
    throw new Error("FLAG_NOT_FOUND");
  }
  await ctx.db.patch(flag._id, { value, updatedAt: Date.now() });
}

/** Turn a flag on (set its value to `true`). */
export const enable = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setValue(ctx, args.key, true);
    return null;
  },
});

/** Turn a flag off (set its value to `false`). */
export const disable = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setValue(ctx, args.key, false);
    return null;
  },
});

/** Permanently delete a flag. */
export const remove = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const flag = await findByKey(ctx, args.key);
    if (flag === null) {
      throw new Error("FLAG_NOT_FOUND");
    }
    await ctx.db.delete(flag._id);
    return null;
  },
});
