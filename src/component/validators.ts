import { v } from "convex/values";

/**
 * Column validators for a stored flag document (excluding Convex system fields).
 * Shared between the schema and the query return validators.
 */
export const flagFields = {
  key: v.string(),
  description: v.optional(v.string()),
  value: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
};

/** Public shape of a flag document returned by queries. */
export const flagDoc = v.object({
  _id: v.id("flags"),
  _creationTime: v.number(),
  ...flagFields,
});

/** Result of evaluating one flag: the boolean value plus a reason code. */
export const evaluation = v.object({
  value: v.boolean(),
  reason: v.string(),
});
