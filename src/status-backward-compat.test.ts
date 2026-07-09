import { describe, expect, test } from "vitest";
import { flagFields } from "./component/validators.js";
import { evaluateFlag } from "./shared.js";

/**
 * Regression guard for #5 — a required `status` field broke deploys for any
 * consumer with flag rows written before `status` existed. The expand fix makes
 * `status` optional and reads an absent status as `"active"`.
 */
describe("status backward compatibility (#5)", () => {
  test("the schema validator accepts a row without `status` (legacy data)", () => {
    // If this reverts to required, a consumer's next `convex deploy` fails schema
    // validation on its pre-existing flag documents.
    expect(flagFields.status.isOptional).toBe("optional");
  });

  test("a flag with no `status` is evaluated as active, not disabled", () => {
    expect(evaluateFlag("legacy", { value: true }, {})).toEqual({
      value: true,
      reason: "flag",
    });
  });

  test("a status-less flag still runs targeting (absent status !== archived)", () => {
    expect(
      evaluateFlag(
        "legacy",
        { value: "BASE", rules: [{ conditions: [], value: "RULE" }] },
        {},
      ),
    ).toEqual({ value: "RULE", reason: "rule" });
  });

  test("an explicitly archived flag is still disabled", () => {
    expect(evaluateFlag("k", { value: "BASE", status: "archived" }, {})).toEqual({
      value: "BASE",
      reason: "disabled",
    });
  });
});
