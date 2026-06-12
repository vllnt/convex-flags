/** Shared constants + types used by both `client/` and `component/`. */

/**
 * Why an evaluation returned the value it did. Stable string codes so hosts can
 * branch on the reason without parsing prose.
 */
export const EVAL_REASON = {
  /** A defined flag served its current value. */
  flag: "flag",
  /** No flag exists for the key; the safe default (`false`) was served. */
  unknown: "unknown",
} as const;

/** The set of evaluation reason codes. */
export type EvalReason = (typeof EVAL_REASON)[keyof typeof EVAL_REASON];

/** Result of evaluating a single flag. */
export interface FlagEvaluation {
  value: boolean;
  reason: EvalReason;
}
