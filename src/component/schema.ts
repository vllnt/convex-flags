import { defineSchema, defineTable } from "convex/server";
import { flagFields } from "./validators.js";

/**
 * Sandboxed tables — the component's own concern only. A flag is keyed by an
 * opaque, host-chosen string; the component never models the host's domain.
 */
export default defineSchema({
  flags: defineTable(flagFields).index("by_key", ["key"]),
});
