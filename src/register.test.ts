/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { describe, expect, test } from "vitest";
import { components } from "../example/convex/_generated/api.js";
import { register } from "./test.js";

/** A host app with a table of its own, as consumers of `/test` have. */
const hostSchema = defineSchema({
  messages: defineTable({ body: v.string() }),
});

/** Any module map with a `_generated` directory works as the host root. */
const hostModules = import.meta.glob("../example/convex/**/*.ts");

describe("register (./test entry)", () => {
  test("mounts the component on a host app whose schema has its own tables", async () => {
    const t = convexTest(hostSchema, hostModules);
    register(t);
    await t.mutation(components.flags.mutations.define, { key: "f", value: "on" });
    expect(
      await t.query(components.flags.queries.evaluate, { key: "f", context: {} }),
    ).toEqual({ value: "on", reason: "flag" });
    await t.run((ctx) => ctx.db.insert("messages", { body: "hi" }));
    expect(await t.run((ctx) => ctx.db.query("messages").collect())).toMatchObject([
      { body: "hi" },
    ]);
  });
});
