import { defineSchema, defineTable } from "convex/server";
import { flagFields, overrideFields } from "./validators.js";

/**
 * Sandboxed tables — the component's own concern only. A flag is keyed by an
 * opaque, host-chosen string; the component never models the host's domain.
 */
export default defineSchema({
  flags: defineTable(flagFields).index("by_key", ["key"]),
  // Per-subject overrides: force a flag's value for one subject. Indexed for
  // both the single-flag read (by_key_subject) and the bulk `all` read
  // (by_subject), so neither path queries inside a loop.
  overrides: defineTable(overrideFields)
    .index("by_key_subject", ["key", "subjectRef"])
    .index("by_subject", ["subjectRef"]),
});
