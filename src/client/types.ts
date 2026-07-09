import type {
  EvalContext,
  EvalReason,
  FlagEvaluation,
  Rollout,
  Rule,
  Variant,
  VariantValue,
} from "../shared.js";

/** A flag document as returned by the component queries. */
export interface FlagDoc {
  _id: string;
  _creationTime: number;
  key: string;
  description?: string;
  value: VariantValue;
  variants?: Variant[];
  rules?: Rule[];
  rollout?: Rollout;
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
}

/** A flag definition passed to {@link Flags.define}. */
export interface FlagDefinition {
  key: string;
  value: VariantValue;
  description?: string;
  variants?: Variant[];
  rules?: Rule[];
  rollout?: Rollout;
}

/**
 * A partial patch passed to {@link Flags.update}. Only the supplied fields are
 * changed; omitted fields are left untouched (unlike {@link FlagDefinition},
 * which fully replaces the definition). The key is passed separately.
 */
export interface FlagUpdate {
  value?: VariantValue;
  description?: string;
  variants?: Variant[];
  rules?: Rule[];
  rollout?: Rollout;
}

/** Options for {@link Flags.evaluate} / {@link Flags.variant}. */
export interface EvalOptions {
  /** Host-supplied targeting/bucketing context. */
  context?: EvalContext;
  /** Value to serve when the key is unknown (reason `default`). */
  default?: VariantValue;
}

export type {
  EvalContext,
  EvalReason,
  FlagEvaluation,
  Rollout,
  Rule,
  Variant,
  VariantValue,
};
