/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { register } from "../../src/test.js";
import type { ConditionOp } from "../../src/shared.js";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

// ---------------------------------------------------------------------------
// Boolean kill-switch core (back-compat with 0.1.0)
// ---------------------------------------------------------------------------

describe("boolean core", () => {
  test("define inserts a flag; evaluate + isEnabled serve its value", async () => {
    const t = setup();
    const id = await t.mutation(api.example.define, {
      key: "new-checkout",
      value: true,
      description: "rebuilt checkout flow",
    });
    expect(typeof id).toBe("string");
    expect(await t.query(api.example.evaluate, { key: "new-checkout" })).toEqual({
      value: true,
      reason: "flag",
    });
    expect(await t.query(api.example.isEnabled, { key: "new-checkout" })).toBe(true);
  });

  test("define is an upsert: same key keeps the id and updates the value", async () => {
    const t = setup();
    const id1 = await t.mutation(api.example.define, { key: "f", value: false });
    const id2 = await t.mutation(api.example.define, { key: "f", value: true });
    expect(id2).toBe(id1);
    const doc = await t.query(api.example.get, { key: "f" });
    expect(doc?.value).toBe(true);
    expect(doc?.status).toBe("active");
  });

  test("unknown key → unknown/false; get is null", async () => {
    const t = setup();
    expect(await t.query(api.example.evaluate, { key: "missing" })).toEqual({
      value: false,
      reason: "unknown",
    });
    expect(await t.query(api.example.isEnabled, { key: "missing" })).toBe(false);
    expect(await t.query(api.example.get, { key: "missing" })).toBeNull();
  });

  test("unknown key with a caller default → reason default", async () => {
    const t = setup();
    expect(
      await t.query(api.example.evaluate, { key: "missing", default: "fallback" }),
    ).toEqual({ value: "fallback", reason: "default" });
  });

  test("enable / disable toggle a flag", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "k", value: false });
    await t.mutation(api.example.enable, { key: "k" });
    expect(await t.query(api.example.isEnabled, { key: "k" })).toBe(true);
    await t.mutation(api.example.disable, { key: "k" });
    expect(await t.query(api.example.isEnabled, { key: "k" })).toBe(false);
  });

  test("list and all reflect every defined flag", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "a", value: true });
    await t.mutation(api.example.define, { key: "b", value: false });
    expect(await t.query(api.example.list, {})).toHaveLength(2);
    expect(await t.query(api.example.all, {})).toEqual({
      a: { value: true, reason: "flag" },
      b: { value: false, reason: "flag" },
    });
  });

  test("remove deletes a flag", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "z", value: true });
    await t.mutation(api.example.remove, { key: "z" });
    expect(await t.query(api.example.get, { key: "z" })).toBeNull();
  });

  test("enable / disable / remove / archive / restore on an unknown key throw FLAG_NOT_FOUND", async () => {
    const t = setup();
    for (const fn of [
      api.example.enable,
      api.example.disable,
      api.example.remove,
      api.example.archive,
      api.example.restore,
    ]) {
      await expect(t.mutation(fn, { key: "nope" })).rejects.toThrow("FLAG_NOT_FOUND");
    }
    await expect(
      t.mutation(api.example.setOverride, { key: "nope", subjectRef: "u", value: true }),
    ).rejects.toThrow("FLAG_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// Variants (multivariate)
// ---------------------------------------------------------------------------

describe("variants", () => {
  test("a string-valued flag evaluates to its variant value", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "theme",
      value: "control",
      variants: [
        { value: "control", label: "Control" },
        { value: "blue" },
      ],
    });
    expect(await t.query(api.example.evaluate, { key: "theme" })).toEqual({
      value: "control",
      reason: "flag",
    });
    expect(await t.query(api.example.variantOf, { key: "theme" })).toBe("control");
    // isEnabled on a non-boolean flag is false (value !== true).
    expect(await t.query(api.example.isEnabled, { key: "theme" })).toBe(false);
    const doc = await t.query(api.example.get, { key: "theme" });
    expect(doc?.variants).toHaveLength(2);
  });

  test("a number-valued flag round-trips", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "limit", value: 10 });
    expect(await t.query(api.example.variantOf, { key: "limit" })).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Targeting rules — every operator, match + no-match + type guards
// ---------------------------------------------------------------------------

type AttrValue = boolean | string | number;

const OPERATOR_CASES: ReadonlyArray<{
  op: ConditionOp;
  operand: AttrValue[];
  actual: AttrValue;
  match: boolean;
}> = [
  { op: "eq", operand: ["a"], actual: "a", match: true },
  { op: "eq", operand: ["a"], actual: "b", match: false },
  { op: "neq", operand: ["a"], actual: "b", match: true },
  { op: "neq", operand: ["a"], actual: "a", match: false },
  { op: "in", operand: ["a", "b"], actual: "a", match: true },
  { op: "in", operand: ["a", "b"], actual: "c", match: false },
  { op: "nin", operand: ["a", "b"], actual: "c", match: true },
  { op: "nin", operand: ["a", "b"], actual: "a", match: false },
  { op: "contains", operand: ["ell"], actual: "hello", match: true },
  { op: "contains", operand: ["xyz"], actual: "hello", match: false },
  { op: "contains", operand: ["ell"], actual: 5, match: false }, // actual not string
  { op: "contains", operand: [5], actual: "hello", match: false }, // operand not string
  { op: "gt", operand: [5], actual: 10, match: true },
  { op: "gt", operand: [5], actual: 3, match: false },
  { op: "gt", operand: [5], actual: "x", match: false }, // actual not number
  { op: "gt", operand: ["y"], actual: 10, match: false }, // operand not number
  { op: "gte", operand: [5], actual: 5, match: true },
  { op: "gte", operand: [5], actual: 4, match: false },
  { op: "gte", operand: [5], actual: "x", match: false },
  { op: "gte", operand: ["y"], actual: 5, match: false },
  { op: "lt", operand: [5], actual: 3, match: true },
  { op: "lt", operand: [5], actual: 7, match: false },
  { op: "lt", operand: [5], actual: "x", match: false },
  { op: "lt", operand: ["y"], actual: 3, match: false },
  { op: "lte", operand: [5], actual: 5, match: true },
  { op: "lte", operand: [5], actual: 7, match: false },
  { op: "lte", operand: [5], actual: "x", match: false },
  { op: "lte", operand: ["y"], actual: 5, match: false },
];

describe("targeting operators", () => {
  test.each(OPERATOR_CASES)(
    "$op actual=$actual operand=$operand → match=$match",
    async ({ op, operand, actual, match }) => {
      const t = setup();
      await t.mutation(api.example.define, {
        key: "t",
        value: "BASE",
        rules: [{ conditions: [{ attribute: "x", op, values: operand }], value: "HIT" }],
      });
      const result = await t.query(api.example.evaluate, {
        key: "t",
        context: { attributes: { x: actual } },
      });
      expect(result).toEqual(
        match ? { value: "HIT", reason: "rule" } : { value: "BASE", reason: "flag" },
      );
    },
  );

  test("a missing attribute never matches", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "t",
      value: "BASE",
      rules: [{ conditions: [{ attribute: "plan", op: "eq", values: ["pro"] }], value: "HIT" }],
    });
    expect(await t.query(api.example.evaluate, { key: "t", context: {} })).toEqual({
      value: "BASE",
      reason: "flag",
    });
  });

  test("an empty-condition rule is a catch-all", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "t",
      value: "BASE",
      rules: [{ conditions: [], value: "ALWAYS" }],
    });
    expect(await t.query(api.example.evaluate, { key: "t" })).toEqual({
      value: "ALWAYS",
      reason: "rule",
    });
  });

  test("first matching rule wins; all conditions in a rule AND together", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "t",
      value: "BASE",
      rules: [
        {
          conditions: [
            { attribute: "plan", op: "eq", values: ["pro"] },
            { attribute: "region", op: "in", values: ["us", "ca"] },
          ],
          value: "FIRST",
        },
        { conditions: [{ attribute: "plan", op: "eq", values: ["pro"] }], value: "SECOND" },
      ],
    });
    // Both conditions of rule 1 hold → FIRST.
    expect(
      await t.query(api.example.evaluate, {
        key: "t",
        context: { attributes: { plan: "pro", region: "us" } },
      }),
    ).toEqual({ value: "FIRST", reason: "rule" });
    // Rule 1's region fails → rule 2 matches → SECOND.
    expect(
      await t.query(api.example.evaluate, {
        key: "t",
        context: { attributes: { plan: "pro", region: "eu" } },
      }),
    ).toEqual({ value: "SECOND", reason: "rule" });
  });
});

// ---------------------------------------------------------------------------
// Rollouts — bucketing, by-attribute, fallthrough, degenerate cases
// ---------------------------------------------------------------------------

describe("rollouts", () => {
  test("fallthrough rollout buckets by subjectRef, stably and distributed", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "exp",
      value: "BASE",
      rollout: {
        splits: [
          { value: "A", weight: 50 },
          { value: "B", weight: 50 },
        ],
      },
    });
    const seen = new Set<unknown>();
    let lastForU3: unknown;
    for (let i = 0; i < 30; i++) {
      const r = await t.query(api.example.evaluate, {
        key: "exp",
        context: { subjectRef: `u${i}` },
      });
      expect(r.reason).toBe("rollout");
      expect(["A", "B"]).toContain(r.value);
      seen.add(r.value);
      if (i === 3) lastForU3 = r.value;
    }
    // Both variants appear (covers both split branches).
    expect(seen).toEqual(new Set(["A", "B"]));
    // Stable: same subject → same value on re-evaluation.
    const again = await t.query(api.example.evaluate, {
      key: "exp",
      context: { subjectRef: "u3" },
    });
    expect(again.value).toBe(lastForU3);
  });

  test("rollout with no bucketing subject falls through to the flag value", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "exp",
      value: "BASE",
      rollout: { splits: [{ value: "A", weight: 100 }] },
    });
    expect(await t.query(api.example.evaluate, { key: "exp", context: {} })).toEqual({
      value: "BASE",
      reason: "flag",
    });
  });

  test("rollout buckets by a named attribute", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "exp",
      value: "BASE",
      rollout: { splits: [{ value: "A", weight: 100 }], by: "region" },
    });
    expect(
      await t.query(api.example.evaluate, {
        key: "exp",
        context: { attributes: { region: "us" } },
      }),
    ).toEqual({ value: "A", reason: "rollout" });
  });

  test("a rollout with no positive-weight split falls through", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "exp",
      value: "BASE",
      rollout: { splits: [{ value: "A", weight: 0 }] },
    });
    expect(
      await t.query(api.example.evaluate, { key: "exp", context: { subjectRef: "u1" } }),
    ).toEqual({ value: "BASE", reason: "flag" });
  });

  test("a rule outcome can be a rollout; an unbucketable rule rollout falls through", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "exp",
      value: "BASE",
      rules: [
        { conditions: [{ attribute: "beta", op: "eq", values: [true] }], rollout: { splits: [{ value: "A", weight: 100 }] } },
      ],
    });
    // Rule matches + subject present → rollout assigns A.
    expect(
      await t.query(api.example.evaluate, {
        key: "exp",
        context: { subjectRef: "u1", attributes: { beta: true } },
      }),
    ).toEqual({ value: "A", reason: "rollout" });
    // Rule matches but no subject to bucket → falls through to flag value.
    expect(
      await t.query(api.example.evaluate, {
        key: "exp",
        context: { attributes: { beta: true } },
      }),
    ).toEqual({ value: "BASE", reason: "flag" });
  });
});

// ---------------------------------------------------------------------------
// Lifecycle — archive / restore
// ---------------------------------------------------------------------------

describe("lifecycle", () => {
  test("archive skips targeting and serves the base value as disabled; restore re-activates", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "k",
      value: "BASE",
      rules: [{ conditions: [], value: "RULE" }],
    });
    expect((await t.query(api.example.evaluate, { key: "k" })).reason).toBe("rule");
    await t.mutation(api.example.archive, { key: "k" });
    expect(await t.query(api.example.evaluate, { key: "k" })).toEqual({
      value: "BASE",
      reason: "disabled",
    });
    expect((await t.query(api.example.get, { key: "k" }))?.status).toBe("archived");
    await t.mutation(api.example.restore, { key: "k" });
    expect((await t.query(api.example.evaluate, { key: "k" })).reason).toBe("rule");
  });
});

// ---------------------------------------------------------------------------
// Partial update (define replaces, update patches)
// ---------------------------------------------------------------------------

describe("update", () => {
  test("updating ONLY rollout leaves rules intact", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "k",
      value: "a",
      rules: [{ conditions: [{ attribute: "plan", op: "eq", values: ["pro"] }], value: "b" }],
    });
    await t.mutation(api.example.update, {
      key: "k",
      rollout: { splits: [{ value: "a", weight: 1 }] },
    });
    const doc = await t.query(api.example.get, { key: "k" });
    expect(doc?.rules).toHaveLength(1);
    expect(doc?.rollout).toEqual({ splits: [{ value: "a", weight: 1 }] });
  });

  test("updating ONLY value leaves rollout intact", async () => {
    const t = setup();
    await t.mutation(api.example.define, {
      key: "k",
      value: "a",
      rollout: { splits: [{ value: "a", weight: 1 }] },
    });
    await t.mutation(api.example.update, { key: "k", value: "c" });
    const doc = await t.query(api.example.get, { key: "k" });
    expect(doc?.value).toBe("c");
    expect(doc?.rollout).toEqual({ splits: [{ value: "a", weight: 1 }] });
  });

  test("updating description leaves the value untouched", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "k", value: true });
    await t.mutation(api.example.update, { key: "k", description: "now documented" });
    const doc = await t.query(api.example.get, { key: "k" });
    expect(doc?.description).toBe("now documented");
    expect(doc?.value).toBe(true);
  });

  test("a multi-field update patches every supplied field at once", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "k", value: "a" });
    await t.mutation(api.example.update, {
      key: "k",
      value: "b",
      description: "multi",
      variants: [{ value: "a" }, { value: "b" }],
      rules: [{ conditions: [{ attribute: "plan", op: "eq", values: ["pro"] }], value: "b" }],
      rollout: { splits: [{ value: "a", weight: 1 }] },
    });
    const doc = await t.query(api.example.get, { key: "k" });
    expect(doc?.value).toBe("b");
    expect(doc?.description).toBe("multi");
    expect(doc?.variants).toHaveLength(2);
    expect(doc?.rules).toHaveLength(1);
    expect(doc?.rollout).toEqual({ splits: [{ value: "a", weight: 1 }] });
  });

  test("update on an unknown key throws FLAG_NOT_FOUND", async () => {
    const t = setup();
    await expect(
      t.mutation(api.example.update, { key: "missing", value: true }),
    ).rejects.toThrow("FLAG_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// Per-subject overrides
// ---------------------------------------------------------------------------

describe("overrides", () => {
  test("setOverride forces a value for one subject; clearOverride removes it", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "k", value: false });
    await t.mutation(api.example.setOverride, { key: "k", subjectRef: "u1", value: true });
    // Overridden subject.
    expect(
      await t.query(api.example.evaluate, { key: "k", context: { subjectRef: "u1" } }),
    ).toEqual({ value: true, reason: "override" });
    // A different subject is unaffected.
    expect(
      await t.query(api.example.evaluate, { key: "k", context: { subjectRef: "u2" } }),
    ).toEqual({ value: false, reason: "flag" });
    // Update the override in place.
    await t.mutation(api.example.setOverride, { key: "k", subjectRef: "u1", value: false });
    expect(
      (await t.query(api.example.evaluate, { key: "k", context: { subjectRef: "u1" } })).value,
    ).toBe(false);
    // Clear it → back to the flag value.
    await t.mutation(api.example.clearOverride, { key: "k", subjectRef: "u1" });
    expect(
      await t.query(api.example.evaluate, { key: "k", context: { subjectRef: "u1" } }),
    ).toEqual({ value: false, reason: "flag" });
    // Clearing a nonexistent override is a no-op.
    await t.mutation(api.example.clearOverride, { key: "k", subjectRef: "ghost" });
  });

  test("all() applies overrides for the context subject", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "a", value: false });
    await t.mutation(api.example.define, { key: "b", value: false });
    await t.mutation(api.example.setOverride, { key: "a", subjectRef: "u1", value: true });
    // With subject → a is overridden, b is not.
    expect(await t.query(api.example.all, { context: { subjectRef: "u1" } })).toEqual({
      a: { value: true, reason: "override" },
      b: { value: false, reason: "flag" },
    });
    // Without subject → no overrides applied.
    expect(await t.query(api.example.all, {})).toEqual({
      a: { value: false, reason: "flag" },
      b: { value: false, reason: "flag" },
    });
  });

  test("remove deletes a flag's overrides too", async () => {
    const t = setup();
    await t.mutation(api.example.define, { key: "k", value: false });
    await t.mutation(api.example.setOverride, { key: "k", subjectRef: "u1", value: true });
    await t.mutation(api.example.remove, { key: "k" });
    // Re-create the same key; the old override must be gone.
    await t.mutation(api.example.define, { key: "k", value: false });
    expect(
      await t.query(api.example.evaluate, { key: "k", context: { subjectRef: "u1" } }),
    ).toEqual({ value: false, reason: "flag" });
  });
});
