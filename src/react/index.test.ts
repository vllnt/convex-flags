// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { makeFunctionReference } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { useFlag, useFlags, type AllRef, type EvaluateRef } from "./index.js";

const { useQuerySpy } = vi.hoisted(() => ({ useQuerySpy: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: useQuerySpy }));

const evalRef: EvaluateRef = makeFunctionReference<"query">("flags:evaluate");
const allRef: AllRef = makeFunctionReference<"query">("flags:all");

beforeEach(() => {
  useQuerySpy.mockReset();
  useQuerySpy.mockReturnValue({ value: true, reason: "flag" });
});

test("useFlag forwards key + context + default and returns the query result", () => {
  const { result } = renderHook(() =>
    useFlag(evalRef, "new-checkout", {
      context: { subjectRef: "u1", attributes: { plan: "pro" } },
      default: "off",
    }),
  );
  expect(useQuerySpy).toHaveBeenCalledWith(evalRef, {
    key: "new-checkout",
    context: { subjectRef: "u1", attributes: { plan: "pro" } },
    default: "off",
  });
  expect(result.current).toEqual({ value: true, reason: "flag" });
});

test("useFlag works with no options", () => {
  renderHook(() => useFlag(evalRef, "k"));
  expect(useQuerySpy).toHaveBeenCalledWith(evalRef, {
    key: "k",
    context: undefined,
    default: undefined,
  });
});

test("useFlags forwards context", () => {
  useQuerySpy.mockReturnValue({ k: { value: true, reason: "flag" } });
  const { result } = renderHook(() => useFlags(allRef, { subjectRef: "u1" }));
  expect(useQuerySpy).toHaveBeenCalledWith(allRef, { context: { subjectRef: "u1" } });
  expect(result.current).toEqual({ k: { value: true, reason: "flag" } });
});

test("useFlags works with no context", () => {
  renderHook(() => useFlags(allRef));
  expect(useQuerySpy).toHaveBeenCalledWith(allRef, { context: undefined });
});
