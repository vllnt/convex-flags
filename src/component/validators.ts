import { v } from "convex/values";

/**
 * A flag/variant value — typed primitives only (boolean, string, number). The
 * client class is generic over the host's concrete value type; the component
 * stores the typed union. No `v.any()`.
 */
export const variantValue = v.union(v.boolean(), v.string(), v.number());

/** An attribute value usable in a targeting comparison. */
export const attributeValue = v.union(v.boolean(), v.string(), v.number());

/** Comparison operators available to a targeting condition. */
export const conditionOp = v.union(
  v.literal("eq"),
  v.literal("neq"),
  v.literal("in"),
  v.literal("nin"),
  v.literal("contains"),
  v.literal("gt"),
  v.literal("gte"),
  v.literal("lt"),
  v.literal("lte"),
);

/** One targeting condition: `<attribute> <op> <values>`. */
export const condition = v.object({
  attribute: v.string(),
  op: conditionOp,
  values: v.array(attributeValue),
});

/** One weighted entry in a rollout's distribution. */
export const split = v.object({ value: variantValue, weight: v.number() });

/** A deterministic weighted distribution across variant values. */
export const rollout = v.object({
  splits: v.array(split),
  by: v.optional(v.string()),
});

/** A declared variant (metadata for tooling / labels). */
export const variant = v.object({ value: variantValue, label: v.optional(v.string()) });

/** A targeting rule: all conditions AND; first matching rule (in order) wins. */
export const rule = v.object({
  conditions: v.array(condition),
  value: v.optional(variantValue),
  rollout: v.optional(rollout),
});

/** Lifecycle status of a flag. */
export const flagStatus = v.union(v.literal("active"), v.literal("archived"));

/**
 * Column validators for a stored flag document (excluding Convex system fields).
 * Shared between the schema and the query return validators.
 */
export const flagFields = {
  key: v.string(),
  description: v.optional(v.string()),
  value: variantValue,
  variants: v.optional(v.array(variant)),
  rules: v.optional(v.array(rule)),
  rollout: v.optional(rollout),
  status: flagStatus,
  createdAt: v.number(),
  updatedAt: v.number(),
};

/** Public shape of a flag document returned by queries. */
export const flagDoc = v.object({
  _id: v.id("flags"),
  _creationTime: v.number(),
  ...flagFields,
});

/** Column validators for a stored per-subject override. */
export const overrideFields = {
  key: v.string(),
  subjectRef: v.string(),
  value: variantValue,
  createdAt: v.number(),
};

/** Host-supplied, per-evaluation context. */
export const evalContext = v.object({
  subjectRef: v.optional(v.string()),
  attributes: v.optional(v.record(v.string(), attributeValue)),
});

/** Stable evaluation reason codes (kept in sync with `EVAL_REASON` in shared.ts). */
export const evalReason = v.union(
  v.literal("flag"),
  v.literal("rule"),
  v.literal("rollout"),
  v.literal("override"),
  v.literal("disabled"),
  v.literal("default"),
  v.literal("unknown"),
);

/** Result of evaluating one flag: the value plus a reason code. */
export const evaluation = v.object({ value: variantValue, reason: evalReason });
