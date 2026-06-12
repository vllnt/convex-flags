/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { register } from "../../src/test.js";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

test("define inserts a flag; evaluate + isEnabled serve its value (happy path)", async () => {
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
  expect(doc.value).toBe(true);
});

test("evaluate / isEnabled / get on an unknown key return the safe default", async () => {
  const t = setup();
  expect(await t.query(api.example.evaluate, { key: "missing" })).toEqual({
    value: false,
    reason: "unknown",
  });
  expect(await t.query(api.example.isEnabled, { key: "missing" })).toBe(false);
  expect(await t.query(api.example.get, { key: "missing" })).toBeNull();
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

test("enable / disable / remove on an unknown key throw FLAG_NOT_FOUND (adversarial)", async () => {
  const t = setup();
  await expect(
    t.mutation(api.example.enable, { key: "nope" }),
  ).rejects.toThrow("FLAG_NOT_FOUND");
  await expect(
    t.mutation(api.example.disable, { key: "nope" }),
  ).rejects.toThrow("FLAG_NOT_FOUND");
  await expect(
    t.mutation(api.example.remove, { key: "nope" }),
  ).rejects.toThrow("FLAG_NOT_FOUND");
});
