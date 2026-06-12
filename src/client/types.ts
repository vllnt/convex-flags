import type { EvalReason, FlagEvaluation } from "../shared.js";

/** A flag document as returned by the component queries. */
export interface FlagDoc {
  _id: string;
  _creationTime: number;
  key: string;
  description?: string;
  value: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A flag definition passed to {@link Flags.define}. */
export interface FlagDefinition {
  key: string;
  value: boolean;
  description?: string;
}

export type { EvalReason, FlagEvaluation };
