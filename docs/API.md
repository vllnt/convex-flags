# API Reference — @vllnt/convex-flags

**Compatibility:** `convex@^1.36.1`

The public surface is the `Flags` client class (`src/client/index.ts`). Construct it once
with the mounted component reference, then call its methods from host
queries/mutations/actions. The host owns auth — gate the management methods (`define`,
`update`, `enable`, `disable`, `archive`, `restore`, `remove`, `setOverride`, `clearOverride`)
behind your own authorized mutations.

```ts
import { Flags } from "@vllnt/convex-flags";
import { components } from "./_generated/api";

const flags = new Flags(components.flags);
```

A flag value is a typed primitive: `boolean | string | number` (the `VariantValue` type). A
boolean flag is the two-variant case; string/number flags are multivariate.

## Mutations

| Method | Args | Returns | Notes |
|--------|------|---------|-------|
| `define(ctx, definition)` | `FlagDefinition` | `Promise<string>` | Create a flag, or **fully replace** its definition (value, description, variants, rules, rollout) if the key exists — fields omitted from the definition are cleared. Status is preserved on replace. Returns the flag id. |
| `update(ctx, key, patch)` | `string, FlagUpdate` | `Promise<null>` | **Partially** update a flag: patch only the supplied fields (the opposite of `define`); omitted fields are left untouched. Throws `FLAG_NOT_FOUND`. |
| `enable(ctx, key)` | `string` | `Promise<null>` | Boolean convenience — set the flag's value to `true`. For multivariate flags use `define`/`update`. Throws `FLAG_NOT_FOUND`. |
| `disable(ctx, key)` | `string` | `Promise<null>` | Boolean convenience — set the flag's value to `false`. For multivariate flags use `define`/`update`. Throws `FLAG_NOT_FOUND`. |
| `archive(ctx, key)` | `string` | `Promise<null>` | Reversibly retire a flag. Evaluation skips targeting and serves the base value with reason `disabled`. Throws `FLAG_NOT_FOUND`. |
| `restore(ctx, key)` | `string` | `Promise<null>` | Return an archived flag to active. Throws `FLAG_NOT_FOUND`. |
| `remove(ctx, key)` | `string` | `Promise<null>` | Permanently delete a flag and its overrides. Throws `FLAG_NOT_FOUND`. |
| `setOverride(ctx, key, subjectRef, value)` | `string, string, VariantValue` | `Promise<null>` | Force a flag's value for one subject. Throws `FLAG_NOT_FOUND`. |
| `clearOverride(ctx, key, subjectRef)` | `string, string` | `Promise<null>` | Remove a subject's override. No-op if none exists. |

## Queries

| Method | Args | Returns | Notes |
|--------|------|---------|-------|
| `get(ctx, key)` | `string` | `Promise<FlagDoc \| null>` | Fetch a single flag definition, or `null`. |
| `list(ctx)` | — | `Promise<FlagDoc[]>` | Every flag definition. |
| `evaluate(ctx, key, options?)` | `string, EvalOptions?` | `Promise<FlagEvaluation>` | Resolve a flag against optional context. |
| `variant(ctx, key, options?)` | `string, EvalOptions?` | `Promise<VariantValue>` | Like `evaluate`, returning just the value. |
| `isEnabled(ctx, key, context?)` | `string, EvalContext?` | `Promise<boolean>` | `true` when the evaluated value is exactly `true`; `false` otherwise (including unknown keys). |
| `all(ctx, context?)` | `EvalContext?` | `Promise<Record<string, FlagEvaluation>>` | Evaluate every flag against the same context — the bootstrap payload for a reactive client. |

## Evaluation order

`evaluate` resolves a flag in this order; the first that applies wins:

1. **Override** — a per-subject override for `context.subjectRef` (reason `override`).
2. **Archived** — an archived flag serves its base value (reason `disabled`); targeting is skipped.
3. **Rules** — targeting rules in order; the first whose conditions all match serves its `value`
   (reason `rule`) or its `rollout` (reason `rollout`).
4. **Fallthrough rollout** — when no rule matched (reason `rollout`).
5. **Flag value** — the base value (reason `flag`).

An **unknown key** returns the caller `default` (reason `default`) or `false` (reason `unknown`).
A rollout that cannot bucket (no `subjectRef`/`by` attribute, or no positive-weight split) falls
through to the flag value.

## Targeting operators

A condition is `{ attribute, op, values }`. A missing attribute never matches.

| Op | Holds when |
|----|------------|
| `eq` / `neq` | attribute equals / does not equal `values[0]` |
| `in` / `nin` | attribute is / is not in `values` |
| `contains` | string attribute contains the string `values[0]` |
| `gt` / `gte` / `lt` / `lte` | numeric attribute compares against the number `values[0]` |

## Rollouts

A rollout distributes across weighted splits, bucketed deterministically by a stable subject so a
given subject always resolves to the same value:

```ts
{ splits: [{ value: "A", weight: 50 }, { value: "B", weight: 50 }], by: "userId" }
```

`by` names the context attribute to bucket by; when omitted, `context.subjectRef` is used. Weights
are relative (normalized across splits).

## Types

```ts
type VariantValue = boolean | string | number;
type AttributeValue = boolean | string | number;
type EvalReason =
  | "flag" | "rule" | "rollout" | "override" | "disabled" | "default" | "unknown";

interface EvalContext {
  subjectRef?: string;
  attributes?: Record<string, AttributeValue>;
}

interface EvalOptions {
  context?: EvalContext;
  default?: VariantValue;
}

interface Condition {
  attribute: string;
  op: "eq" | "neq" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte";
  values: AttributeValue[];
}

interface Split {
  value: VariantValue;
  weight: number;
}

interface Rollout {
  splits: Split[];
  by?: string;
}

interface Rule {
  conditions: Condition[]; // AND; an empty list is a catch-all
  value?: VariantValue;
  rollout?: Rollout;
}

interface Variant {
  value: VariantValue;
  label?: string;
}

interface FlagDefinition {
  key: string;
  value: VariantValue;
  description?: string;
  variants?: Variant[];
  rules?: Rule[];
  rollout?: Rollout;
}

interface FlagUpdate {
  // Partial patch for `update` — only supplied fields change; key passed separately.
  value?: VariantValue;
  description?: string;
  variants?: Variant[];
  rules?: Rule[];
  rollout?: Rollout;
}

interface FlagDoc {
  _id: string;
  _creationTime: number;
  key: string;
  description?: string;
  value: VariantValue;
  variants?: Variant[];
  rules?: Rule[];
  rollout?: Rollout;
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
}

interface FlagEvaluation {
  value: VariantValue;
  reason: EvalReason;
}
```

## Error codes

| Code | Thrown by | Condition |
|------|-----------|-----------|
| `FLAG_NOT_FOUND` | `update`, `enable`, `disable`, `archive`, `restore`, `remove`, `setOverride` | The flag key does not exist |

## React

The optional `@vllnt/convex-flags/react` entry ships reactive hooks over `convex/react`'s
`useQuery`. They take the host's own re-exported `evaluate` / `all` query refs. `react` is an
optional peer dependency; a backend-only consumer never imports this entry.

```tsx
import { useFlag, useFlags } from "@vllnt/convex-flags/react";
import { api } from "../convex/_generated/api";

const checkout = useFlag(api.flags.evaluate, "new-checkout", {
  context: { subjectRef: userId },
});
// checkout is `undefined` while loading, then { value, reason }.
```

| Hook | Args | Returns |
|------|------|---------|
| `useFlag(query, key, options?)` | evaluate ref, `string`, `UseFlagOptions?` | `FlagEvaluation \| undefined` |
| `useFlags(query, context?)` | all ref, `EvalContext?` | `Record<string, FlagEvaluation> \| undefined` |
