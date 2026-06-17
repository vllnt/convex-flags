/**
 * Shared constants, types, and the pure evaluation engine used by both
 * `client/` and `component/`.
 *
 * The engine is intentionally pure — no `ctx`, no database — so it can be
 * reused by the component queries and exercised exhaustively end-to-end. Per-
 * subject overrides and unknown-key handling live in the query layer (they need
 * a database read); everything from a flag document downward lives here.
 */

/**
 * Why an evaluation returned the value it did. Stable string codes so hosts can
 * branch on the reason without parsing prose.
 */
export const EVAL_REASON = {
  /** Served the flag's fallthrough value — no rule or rollout matched. */
  flag: "flag",
  /** A targeting rule matched and served a fixed value. */
  rule: "rule",
  /** A percentage rollout deterministically assigned the value. */
  rollout: "rollout",
  /** A per-subject override forced the value. */
  override: "override",
  /** The flag is archived; targeting was skipped and its base value served. */
  disabled: "disabled",
  /** Unknown key; the caller-supplied default was served. */
  default: "default",
  /** Unknown key and no caller default; the safe default (`false`) was served. */
  unknown: "unknown",
} as const;

/** The set of evaluation reason codes. */
export type EvalReason = (typeof EVAL_REASON)[keyof typeof EVAL_REASON];

/**
 * A flag/variant value. Typed primitives only — never `v.any()`. JSON-object
 * variants are a documented future last resort (tracked in the roadmap).
 */
export type VariantValue = boolean | string | number;

/** An attribute value usable in a targeting comparison. */
export type AttributeValue = boolean | string | number;

/**
 * Host-supplied, per-evaluation context. Opaque to the component: the host owns
 * what `subjectRef` and the attribute names/values mean.
 */
export interface EvalContext {
  /** Stable identifier used for rollout bucketing (e.g. a user or session ref). */
  subjectRef?: string;
  /** Targeting attributes, keyed by host-chosen names. */
  attributes?: Record<string, AttributeValue>;
}

/** Result of evaluating a single flag. */
export interface FlagEvaluation {
  value: VariantValue;
  reason: EvalReason;
}

/** Comparison operators available to a targeting condition. */
export type ConditionOp =
  | "eq"
  | "neq"
  | "in"
  | "nin"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

/** One targeting condition: `<attribute> <op> <values>`. */
export interface Condition {
  attribute: string;
  op: ConditionOp;
  values: AttributeValue[];
}

/** One weighted entry in a rollout's distribution. */
export interface Split {
  value: VariantValue;
  /** Relative weight; normalized across the rollout's splits. */
  weight: number;
}

/** A deterministic weighted distribution across variant values. */
export interface Rollout {
  splits: Split[];
  /** Context attribute to bucket by; defaults to `subjectRef` when omitted. */
  by?: string;
}

/** A declared variant (metadata for tooling / labels). */
export interface Variant {
  value: VariantValue;
  label?: string;
}

/**
 * A targeting rule. All `conditions` must match (AND); rules are evaluated in
 * order and the first match wins. The outcome is a fixed `value` or a `rollout`.
 */
export interface Rule {
  conditions: Condition[];
  value?: VariantValue;
  rollout?: Rollout;
}

/** The evaluatable shape of a stored flag (the engine's input). */
export interface EvaluableFlag {
  value: VariantValue;
  status: "active" | "archived";
  rules?: Rule[];
  rollout?: Rollout;
}

/** Operator implementations. A table (not a switch) so there is no unreachable
 * default branch — every operator resolves to one of these. */
const OPERATORS: Record<
  ConditionOp,
  (actual: AttributeValue, values: AttributeValue[]) => boolean
> = {
  eq: (actual, values) => actual === values[0],
  neq: (actual, values) => actual !== values[0],
  in: (actual, values) => values.includes(actual),
  nin: (actual, values) => !values.includes(actual),
  contains: (actual, values) =>
    typeof actual === "string" &&
    typeof values[0] === "string" &&
    actual.includes(values[0]),
  gt: (actual, values) =>
    typeof actual === "number" && typeof values[0] === "number" && actual > values[0],
  gte: (actual, values) =>
    typeof actual === "number" && typeof values[0] === "number" && actual >= values[0],
  lt: (actual, values) =>
    typeof actual === "number" && typeof values[0] === "number" && actual < values[0],
  lte: (actual, values) =>
    typeof actual === "number" && typeof values[0] === "number" && actual <= values[0],
};

/** Does a single condition hold for the given context? A missing attribute never
 * matches (mirrors how mainstream flag SDKs treat absent targeting data). */
function matchesCondition(condition: Condition, context: EvalContext): boolean {
  const actual = context.attributes?.[condition.attribute];
  if (actual === undefined) {
    return false;
  }
  return OPERATORS[condition.op](actual, condition.values);
}

/** Do all of a rule's conditions hold? An empty condition list always matches
 * (a catch-all rule). */
function matchesRule(rule: Rule, context: EvalContext): boolean {
  return rule.conditions.every((condition) => matchesCondition(condition, context));
}

/** Deterministic 32-bit FNV-1a hash of a string → uint32. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministically pick a split's value by hashing `flagKey:subject` across the
 * cumulative weights. Returns `null` when no split has positive weight.
 */
export function pickSplit(
  flagKey: string,
  subject: string,
  splits: Split[],
): VariantValue | null {
  const positive = splits.filter((split) => split.weight > 0);
  const total = positive.reduce((sum, split) => sum + split.weight, 0);
  if (total === 0) {
    return null;
  }
  const point = hashString(`${flagKey}:${subject}`) % total;
  let cumulative = 0;
  let chosen: VariantValue | null = null;
  for (const split of positive) {
    cumulative += split.weight;
    if (chosen === null && point < cumulative) {
      chosen = split.value;
    }
  }
  return chosen;
}

/** Resolve a rollout to a value, or `null` if it cannot bucket (no rollout, no
 * bucketing subject, or no positive-weight split). */
function resolveRollout(
  flagKey: string,
  rollout: Rollout | undefined,
  context: EvalContext,
): VariantValue | null {
  if (rollout === undefined) {
    return null;
  }
  const subject =
    rollout.by !== undefined ? context.attributes?.[rollout.by] : context.subjectRef;
  if (subject === undefined) {
    return null;
  }
  return pickSplit(flagKey, String(subject), rollout.splits);
}

/**
 * Evaluate a flag against context. Pure — given the same flag document and
 * context it always returns the same result.
 */
export function evaluateFlag(
  flagKey: string,
  flag: EvaluableFlag,
  context: EvalContext,
): FlagEvaluation {
  if (flag.status === "archived") {
    return { value: flag.value, reason: EVAL_REASON.disabled };
  }
  for (const rule of flag.rules ?? []) {
    if (matchesRule(rule, context)) {
      if (rule.value !== undefined) {
        return { value: rule.value, reason: EVAL_REASON.rule };
      }
      const picked = resolveRollout(flagKey, rule.rollout, context);
      if (picked !== null) {
        return { value: picked, reason: EVAL_REASON.rollout };
      }
      return { value: flag.value, reason: EVAL_REASON.flag };
    }
  }
  const picked = resolveRollout(flagKey, flag.rollout, context);
  if (picked !== null) {
    return { value: picked, reason: EVAL_REASON.rollout };
  }
  return { value: flag.value, reason: EVAL_REASON.flag };
}
