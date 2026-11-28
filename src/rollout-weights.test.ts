import { describe, expect, test } from "vitest";
import { pickSplit } from "./shared.js";

const SUBJECTS = Array.from({ length: 1000 }, (_, i) => `s${i}`);

function share(flagKey: string, splits: Parameters<typeof pickSplit>[2]): Map<unknown, number> {
  const counts = new Map<unknown, number>();
  for (const subject of SUBJECTS) {
    const value = pickSplit(flagKey, subject, splits);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

describe("rollout weights", () => {
  test("fractional weights 0.5 / 0.5 split subjects roughly evenly", () => {
    const counts = share("frac", [
      { value: "a", weight: 0.5 },
      { value: "b", weight: 0.5 },
    ]);
    expect([...counts.keys()].sort()).toEqual(["a", "b"]);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThanOrEqual(400);
      expect(count).toBeLessThanOrEqual(600);
    }
  });

  test("fractional weights spread subjects that differ only in a trailing digit", () => {
    const half = [
      { value: "a", weight: 0.5 },
      { value: "b", weight: 0.5 },
    ];
    const values = new Set(Array.from({ length: 30 }, (_, i) => pickSplit("frac", `u${i}`, half)));
    expect(values).toEqual(new Set(["a", "b"]));
  });

  test("fractional weights 0.1 / 0.2 / 0.7 follow their proportions", () => {
    const counts = share("frac3", [
      { value: "x", weight: 0.1 },
      { value: "y", weight: 0.2 },
      { value: "z", weight: 0.7 },
    ]);
    expect(counts.get("x")).toBeGreaterThanOrEqual(50);
    expect(counts.get("x")).toBeLessThanOrEqual(150);
    expect(counts.get("y")).toBeGreaterThanOrEqual(150);
    expect(counts.get("y")).toBeLessThanOrEqual(250);
    expect(counts.get("z")).toBeGreaterThanOrEqual(650);
    expect(counts.get("z")).toBeLessThanOrEqual(750);
  });

  test("legacy Infinity weights bucket as in 0.1.0", () => {
    // 0.1.0 stored non-finite weights; pinned from its engine so such rows keep serving.
    const tail = [
      { value: "a", weight: 1 },
      { value: "b", weight: Infinity },
    ];
    const head = [
      { value: "a", weight: Infinity },
      { value: "b", weight: 1 },
    ];
    const headWithDecimal = [
      { value: "a", weight: Infinity },
      { value: "b", weight: 0.5 },
    ];
    const tailWithDecimal = [
      { value: "a", weight: 0.5 },
      { value: "b", weight: Infinity },
    ];
    for (const subject of ["u1", "u2", "u3", "alice", "bob"]) {
      expect(
        [tail, head, headWithDecimal, tailWithDecimal].map((splits) => pickSplit("inf", subject, splits)),
      ).toEqual(["b", "a", "a", "b"]);
    }
  });

  test("integer-weight assignments are unchanged (no re-bucketing)", () => {
    // Pinned from the 0.1.0 engine (`hash % total`); a change here re-buckets live users.
    const even = [
      { value: "A", weight: 50 },
      { value: "B", weight: 50 },
    ];
    const skewed = [
      { value: "red", weight: 1 },
      { value: "green", weight: 2 },
      { value: "blue", weight: 7 },
    ];
    const pinned = {
      u1: ["A", "blue"],
      u2: ["B", "green"],
      u3: ["B", "green"],
      u4: ["A", "blue"],
      u5: ["A", "red"],
      u6: ["B", "blue"],
      alice: ["B", "blue"],
      bob: ["B", "blue"],
    };
    for (const [subject, expected] of Object.entries(pinned)) {
      expect([pickSplit("exp", subject, even), pickSplit("color", subject, skewed)]).toEqual(expected);
    }
  });
});
