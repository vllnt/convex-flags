/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./component/_generated/api.js";
import schema from "./component/schema.js";
import { REMOVE_BATCH } from "./shared.js";

const modules = import.meta.glob("./component/**/*.ts");

const writes = vi.hoisted((): string[] => []);

vi.mock("./component/_generated/server.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./component/_generated/server.js")>();
  const WRITE_METHODS = new Set(["insert", "patch", "replace", "delete"]);
  function countingDb<T extends object>(db: T): T {
    return new Proxy(db, {
      get(target, prop, receiver) {
        const value: unknown = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") {
          return value;
        }
        return (...callArgs: unknown[]) => {
          if (typeof prop === "string" && WRITE_METHODS.has(prop)) {
            writes.push(`${prop}:${String(callArgs[0])}`);
          }
          return Reflect.apply(value, target, callArgs);
        };
      },
    });
  }
  const mutation: typeof original.mutation = (definition) => {
    if (typeof definition === "function") {
      return original.mutation((ctx, args) => definition({ ...ctx, db: countingDb(ctx.db) }, args));
    }
    return original.mutation({
      ...definition,
      handler: (ctx, args) => definition.handler({ ...ctx, db: countingDb(ctx.db) }, args),
    });
  };
  return { ...original, mutation };
});

function writesDuring<T>(run: () => Promise<T>): Promise<string[]> {
  writes.length = 0;
  return run().then(() => [...writes]);
}

function setup() {
  return convexTest(schema, modules);
}

const RULES = [
  {
    conditions: [{ attribute: "plan", op: "in" as const, values: ["pro", "team"] }],
    rollout: { splits: [{ value: true, weight: 1 }], by: "org" },
  },
];

async function updatedAt(t: ReturnType<typeof setup>, key: string): Promise<number | undefined> {
  return (await t.query(api.queries.get, { key }))?.updatedAt;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("flags component — no-op writes are skipped", () => {
  test("re-defining an unchanged flag does not touch it", async () => {
    const t = setup();
    await t.mutation(api.mutations.define, { key: "f", value: false, description: "d", rules: RULES });
    vi.setSystemTime(1000);
    await t.mutation(api.mutations.define, {
      key: "f",
      value: false,
      description: "d",
      rules: [
        {
          rollout: { by: "org", splits: [{ weight: 1, value: true }] },
          conditions: [{ values: ["pro", "team"], op: "in", attribute: "plan" }],
        },
      ],
    });
    expect(await updatedAt(t, "f")).toBe(0);
  });

  test("re-defining with a change patches it and clears omitted optional fields", async () => {
    const t = setup();
    await t.mutation(api.mutations.define, { key: "f", value: false, description: "d", rules: RULES });
    vi.setSystemTime(1000);
    await t.mutation(api.mutations.define, { key: "f", value: false, rules: [] });
    const flag = await t.query(api.queries.get, { key: "f" });
    expect(flag).toMatchObject({ rules: [] });
    expect(flag?.updatedAt).toBeGreaterThanOrEqual(1000);
    expect(flag?.description).toBeUndefined();
  });

  test("update, enable, disable, archive and restore skip unchanged values", async () => {
    const t = setup();
    await t.mutation(api.mutations.define, { key: "f", value: true, rules: RULES });
    vi.setSystemTime(1000);
    await t.mutation(api.mutations.update, { key: "f" });
    await t.mutation(api.mutations.update, { key: "f", value: true, rules: RULES });
    await t.mutation(api.mutations.enable, { key: "f" });
    await t.mutation(api.mutations.restore, { key: "f" });
    expect(await updatedAt(t, "f")).toBe(0);
    await t.mutation(api.mutations.disable, { key: "f" });
    expect(await t.query(api.queries.get, { key: "f" })).toMatchObject({ value: false });
    expect(await updatedAt(t, "f")).toBeGreaterThanOrEqual(1000);
    vi.setSystemTime(2000);
    await t.mutation(api.mutations.archive, { key: "f" });
    const archivedAt = await updatedAt(t, "f");
    vi.setSystemTime(3000);
    await t.mutation(api.mutations.archive, { key: "f" });
    expect(await t.query(api.queries.get, { key: "f" })).toMatchObject({ status: "archived", updatedAt: archivedAt });
    expect(archivedAt).toBeLessThan(3000);
    await t.mutation(api.mutations.update, { key: "f", rules: [RULES[0], RULES[0]] });
    expect(await updatedAt(t, "f")).toBeGreaterThanOrEqual(3000);
  });

  test("setOverride with the same value keeps the override", async () => {
    const t = setup();
    await t.mutation(api.mutations.define, { key: "f", value: false });
    await t.mutation(api.mutations.setOverride, { key: "f", subjectRef: "u", value: true });
    await t.mutation(api.mutations.setOverride, { key: "f", subjectRef: "u", value: true });
    expect(await t.query(api.queries.evaluate, { key: "f", context: { subjectRef: "u" } })).toEqual({
      value: true,
      reason: "override",
    });
    await t.mutation(api.mutations.setOverride, { key: "f", subjectRef: "u", value: false });
    expect(await t.query(api.queries.evaluate, { key: "f", context: { subjectRef: "u" } })).toEqual({
      value: false,
      reason: "override",
    });
  });
});

describe("flags component — exact write counts", () => {
  test("no-op management calls write nothing; real changes patch once", async () => {
    const t = setup();
    await t.mutation(api.mutations.define, { key: "f", value: true, rules: RULES });
    await t.mutation(api.mutations.setOverride, { key: "f", subjectRef: "u", value: true });
    const noops = await writesDuring(async () => {
      await t.mutation(api.mutations.define, { key: "f", value: true, rules: RULES });
      await t.mutation(api.mutations.update, { key: "f", value: true });
      await t.mutation(api.mutations.enable, { key: "f" });
      await t.mutation(api.mutations.restore, { key: "f" });
      await t.mutation(api.mutations.setOverride, { key: "f", subjectRef: "u", value: true });
    });
    expect(noops).toEqual([]);
    const changes = await writesDuring(async () => {
      await t.mutation(api.mutations.disable, { key: "f" });
      await t.mutation(api.mutations.archive, { key: "f" });
      await t.mutation(api.mutations.setOverride, { key: "f", subjectRef: "u", value: false });
    });
    expect(changes).toEqual(["patch:flags", "patch:flags", "patch:overrides"]);
  });
});

describe("flags component — bounded remove", () => {
  test("remove with few overrides deletes everything in one pass, nothing scheduled", async () => {
    const t = setup();
    await t.mutation(api.mutations.define, { key: "f", value: true });
    await t.mutation(api.mutations.setOverride, { key: "f", subjectRef: "u", value: false });
    await t.mutation(api.mutations.remove, { key: "f" });
    const state = await t.run(async (ctx) => ({
      flags: await ctx.db.query("flags").collect(),
      overrides: await ctx.db.query("overrides").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(state).toEqual({ flags: [], overrides: [], scheduled: [] });
  });

  test("remove with more overrides than one batch drains them over continuations", async () => {
    const t = setup();
    await t.mutation(api.mutations.define, { key: "f", value: true });
    await t.mutation(api.mutations.define, { key: "other", value: true });
    await t.run(async (ctx) => {
      for (let i = 0; i < REMOVE_BATCH + 5; i++) {
        await ctx.db.insert("overrides", { key: "f", subjectRef: `u${i}`, value: false, createdAt: 0 });
      }
      await ctx.db.insert("overrides", { key: "other", subjectRef: "u0", value: false, createdAt: 0 });
    });
    await t.mutation(api.mutations.remove, { key: "f" });
    const mid = await t.run(async (ctx) => ({
      flag: await ctx.db.query("flags").withIndex("by_key", (q) => q.eq("key", "f")).unique(),
      overrides: (await ctx.db.query("overrides").collect()).length,
      scheduled: (await ctx.db.system.query("_scheduled_functions").collect()).length,
    }));
    expect(mid.flag).not.toBeNull();
    expect(mid.overrides).toBe(6);
    expect(mid.scheduled).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const end = await t.run(async (ctx) => ({
      flags: (await ctx.db.query("flags").collect()).map((f) => f.key),
      overrides: (await ctx.db.query("overrides").collect()).map((o) => o.key),
    }));
    expect(end).toEqual({ flags: ["other"], overrides: ["other"] });
  });
});
