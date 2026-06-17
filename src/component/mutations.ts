import { v } from "convex/values";
import { mutation } from "./_generated/server.js";
import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { rollout, rule, variant, variantValue } from "./validators.js";

async function findByKey(ctx: MutationCtx, key: string): Promise<Doc<"flags"> | null> {
  return await ctx.db
    .query("flags")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

/** Throws the component's single code-tagged error. Returns `never` so callers
 * narrow the flag to non-null after the guard. */
function flagNotFound(): never {
  throw new Error("FLAG_NOT_FOUND");
}

/**
 * Create a flag, or fully replace its definition if the key already exists
 * (value, description, variants, rules, rollout). Status is preserved on update.
 */
export const define = mutation({
  args: {
    key: v.string(),
    value: variantValue,
    description: v.optional(v.string()),
    variants: v.optional(v.array(variant)),
    rules: v.optional(v.array(rule)),
    rollout: v.optional(rollout),
  },
  returns: v.id("flags"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await findByKey(ctx, args.key);
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description,
        variants: args.variants,
        rules: args.rules,
        rollout: args.rollout,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("flags", {
      key: args.key,
      value: args.value,
      description: args.description,
      variants: args.variants,
      rules: args.rules,
      rollout: args.rollout,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Partially update a flag: patch ONLY the fields supplied (the opposite of
 * `define`, which fully replaces). Omitted fields are left untouched, so
 * re-sending one field never wipes rules/rollout/variants.
 */
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
  handler: async (ctx, args) => {
    const flag = await findByKey(ctx, args.key);
    if (flag === null) {
      flagNotFound();
    }
    const patch: Partial<Doc<"flags">> = { updatedAt: Date.now() };
    if (args.value !== undefined) {
      patch.value = args.value;
    }
    if (args.description !== undefined) {
      patch.description = args.description;
    }
    if (args.variants !== undefined) {
      patch.variants = args.variants;
    }
    if (args.rules !== undefined) {
      patch.rules = args.rules;
    }
    if (args.rollout !== undefined) {
      patch.rollout = args.rollout;
    }
    await ctx.db.patch(flag._id, patch);
    return null;
  },
});

async function setValue(ctx: MutationCtx, key: string, value: boolean): Promise<void> {
  const flag = await findByKey(ctx, key);
  if (flag === null) {
    flagNotFound();
  }
  await ctx.db.patch(flag._id, { value, updatedAt: Date.now() });
}

/** Turn a boolean flag on (set its value to `true`). */
export const enable = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setValue(ctx, args.key, true);
    return null;
  },
});

/** Turn a boolean flag off (set its value to `false`). */
export const disable = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setValue(ctx, args.key, false);
    return null;
  },
});

async function setStatus(
  ctx: MutationCtx,
  key: string,
  status: "active" | "archived",
): Promise<void> {
  const flag = await findByKey(ctx, key);
  if (flag === null) {
    flagNotFound();
  }
  await ctx.db.patch(flag._id, { status, updatedAt: Date.now() });
}

/** Archive a flag: reversible retirement. Evaluation skips targeting and serves
 * the flag's base value with reason `disabled`. */
export const archive = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setStatus(ctx, args.key, "archived");
    return null;
  },
});

/** Restore an archived flag to active. */
export const restore = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setStatus(ctx, args.key, "active");
    return null;
  },
});

/** Permanently delete a flag and any per-subject overrides it owns. */
export const remove = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const flag = await findByKey(ctx, args.key);
    if (flag === null) {
      flagNotFound();
    }
    const overrides = await ctx.db
      .query("overrides")
      .withIndex("by_key_subject", (q) => q.eq("key", args.key))
      .collect();
    for (const override of overrides) {
      await ctx.db.delete(override._id);
    }
    await ctx.db.delete(flag._id);
    return null;
  },
});

/** Force a flag's value for one subject. The flag must exist. */
export const setOverride = mutation({
  args: { key: v.string(), subjectRef: v.string(), value: variantValue },
  returns: v.null(),
  handler: async (ctx, args) => {
    const flag = await findByKey(ctx, args.key);
    if (flag === null) {
      flagNotFound();
    }
    const existing = await ctx.db
      .query("overrides")
      .withIndex("by_key_subject", (q) =>
        q.eq("key", args.key).eq("subjectRef", args.subjectRef),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("overrides", {
        key: args.key,
        subjectRef: args.subjectRef,
        value: args.value,
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

/** Clear a subject's override for a flag. No-op if none exists. */
export const clearOverride = mutation({
  args: { key: v.string(), subjectRef: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("overrides")
      .withIndex("by_key_subject", (q) =>
        q.eq("key", args.key).eq("subjectRef", args.subjectRef),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});
