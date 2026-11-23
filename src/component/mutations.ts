import { ConvexError, v, type Infer } from "convex/values";
import { mutation } from "./_generated/server.js";
import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { rollout, rule, variant, variantValue } from "./validators.js";

type Rollout = Infer<typeof rollout>;
type Rule = Infer<typeof rule>;

async function findByKey(ctx: MutationCtx, key: string): Promise<Doc<"flags"> | null> {
  return await ctx.db
    .query("flags")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

function invalidArgument(message: string): never {
  throw new ConvexError({ code: "INVALID_ARGUMENT", message });
}

/** Reject empty identifiers: an empty key or subject ref can never be targeted
 * meaningfully and would store an unreachable row. */
function assertNonEmpty(fields: Record<string, string>): void {
  for (const [name, value] of Object.entries(fields)) {
    if (value === "") {
      invalidArgument(`${name} must be non-empty`);
    }
  }
}

/** Reject rollout weights that cannot bucket: NaN, infinite, or negative. Zero
 * is allowed (it excludes a split). */
function assertRollouts(
  rollouts: Array<Rollout | undefined>,
  rules: Rule[] | undefined,
): void {
  const all = [...rollouts, ...(rules ?? []).map((r) => r.rollout)];
  for (const r of all) {
    for (const { weight } of r?.splits ?? []) {
      if (!Number.isFinite(weight) || weight < 0) {
        invalidArgument("rollout weights must be finite and non-negative");
      }
    }
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) => sameValue(a[k], b[k]));
  }
  return Object.is(a, b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const FLAG_FIELDS = ["value", "description", "variants", "rules", "rollout"] as const;

function changedFields(
  flag: Doc<"flags">,
  fields: Partial<Pick<Doc<"flags">, "value" | "description" | "variants" | "rules" | "rollout">>,
): Partial<Doc<"flags">> {
  const patch: Partial<Doc<"flags">> = {};
  for (const name of FLAG_FIELDS) {
    if (name in fields && !sameValue(flag[name], fields[name])) {
      Object.assign(patch, { [name]: fields[name] });
    }
  }
  return patch;
}

async function patchIfChanged(
  ctx: MutationCtx,
  flag: Doc<"flags">,
  patch: Partial<Doc<"flags">>,
): Promise<void> {
  if (Object.keys(patch).length > 0) {
    await ctx.db.patch("flags", flag._id, { ...patch, updatedAt: Date.now() });
  }
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
    assertNonEmpty({ key: args.key });
    assertRollouts([args.rollout], args.rules);
    const now = Date.now();
    const existing = await findByKey(ctx, args.key);
    if (existing !== null) {
      await patchIfChanged(
        ctx,
        existing,
        changedFields(existing, {
          value: args.value,
          description: args.description,
          variants: args.variants,
          rules: args.rules,
          rollout: args.rollout,
        }),
      );
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
    assertNonEmpty({ key: args.key });
    assertRollouts([args.rollout], args.rules);
    const flag = await findByKey(ctx, args.key);
    if (flag === null) {
      flagNotFound();
    }
    const fields: Parameters<typeof changedFields>[1] = {};
    for (const name of FLAG_FIELDS) {
      if (args[name] !== undefined) {
        Object.assign(fields, { [name]: args[name] });
      }
    }
    await patchIfChanged(ctx, flag, changedFields(flag, fields));
    return null;
  },
});

async function setValue(ctx: MutationCtx, key: string, value: boolean): Promise<void> {
  assertNonEmpty({ key });
  const flag = await findByKey(ctx, key);
  if (flag === null) {
    flagNotFound();
  }
  await patchIfChanged(ctx, flag, changedFields(flag, { value }));
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
  assertNonEmpty({ key });
  const flag = await findByKey(ctx, key);
  if (flag === null) {
    flagNotFound();
  }
  if (flag.status !== status) {
    await ctx.db.patch("flags", flag._id, { status, updatedAt: Date.now() });
  }
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
    assertNonEmpty({ key: args.key });
    const flag = await findByKey(ctx, args.key);
    if (flag === null) {
      flagNotFound();
    }
    const overrides = await ctx.db
      .query("overrides")
      .withIndex("by_key_subject", (q) => q.eq("key", args.key))
      .collect();
    for (const override of overrides) {
      await ctx.db.delete("overrides", override._id);
    }
    await ctx.db.delete("flags", flag._id);
    return null;
  },
});

/** Force a flag's value for one subject. The flag must exist. */
export const setOverride = mutation({
  args: { key: v.string(), subjectRef: v.string(), value: variantValue },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertNonEmpty({ key: args.key, subjectRef: args.subjectRef });
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
      if (!Object.is(existing.value, args.value)) {
        await ctx.db.patch("overrides", existing._id, { value: args.value });
      }
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
    assertNonEmpty({ key: args.key, subjectRef: args.subjectRef });
    const existing = await ctx.db
      .query("overrides")
      .withIndex("by_key_subject", (q) =>
        q.eq("key", args.key).eq("subjectRef", args.subjectRef),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.delete("overrides", existing._id);
    }
    return null;
  },
});
