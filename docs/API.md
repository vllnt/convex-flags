# API Reference — @vllnt/convex-flags

**Compatibility:** `convex@^1.45.0`; `react@^18.0.0 || ^19.0.0` optional (only
for `./react`). This reference is bundled in the package and describes the
installed version.

## Entry points

| Import                                                | Exports                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@vllnt/convex-flags`                                 | `Flags`; types `FlagsComponent`, `EvalContext`, `EvalOptions`, `FlagDefinition`, `FlagDoc`, `FlagEvaluation`, `FlagUpdate`, `Rollout`, `Rule`, `Variant`, `VariantValue` |
| `@vllnt/convex-flags/convex.config` (or `.js`)        | default component config for `app.use(...)`                                                                                                                              |
| `@vllnt/convex-flags/react`                           | `useFlag`, `useFlags`; types `UseFlagOptions`, `EvaluateRef`, `AllRef`, `EvalContext`, `FlagEvaluation`, `VariantValue`                                                  |
| `@vllnt/convex-flags/test`                            | `register(t, name = "flags")` for `convex-test` (TypeScript source; needs Vite `import.meta.glob`)                                                                       |
| `@vllnt/convex-flags/_generated/component` (or `.js`) | type `ComponentApi`                                                                                                                                                      |

`./package.json` is exported as-is. A flag value is a typed primitive,
`boolean | string | number` ([`VariantValue`](#variantvalue)): a boolean flag is
the two-variant case, string and number flags are multivariate. Flag keys and
subject refs are opaque host strings; the component only rejects empty ones on
writes.

## Client

### `Flags`

```ts
new Flags(component: FlagsComponent)
```

`component` is the mounted component, `components.flags` (or the name passed to
`app.use`). There are no constructor options. Every method takes the host `ctx`
first. The context types are structural: the mutation methods (`define`,
`update`, `enable`, `disable`, `archive`, `restore`, `remove`, `setOverride`,
`clearOverride`) need a context with `runMutation` (a mutation or action
context); the query methods (`get`, `list`, `evaluate`, `variant`, `isEnabled`,
`all`) need a context with `runQuery` (a query, mutation or action context).
From an action, each call runs in its own transaction.

The host owns auth. The component's functions are internal; gate the mutation
methods behind your own authorized mutations.

### `define`

```ts
define(ctx, definition: FlagDefinition): Promise<string>
```

Creates a flag, or **fully replaces** the definition of an existing key (value,
description, variants, rules, rollout), and returns the flag id. Fields left out
of `definition` are cleared. The status (active or archived) is kept on replace;
a new flag starts active. A definition identical to the stored one writes
nothing, so `updatedAt` is kept.

- `definition.key` must be non-empty (`INVALID_ARGUMENT`).
- Every split weight, flag-level or in a rule, must be finite and `>= 0`
  (`INVALID_ARGUMENT`).

### `update`

```ts
update(ctx, key: string, patch: FlagUpdate): Promise<null>
```

**Partially** updates a flag: only the fields present in `patch` change (the
opposite of `define`). A field that is omitted or `undefined` is left as is, so
`update` cannot clear a field; pass an empty value (`rules: []`) or use
`define`. Throws `FLAG_NOT_FOUND` for an unknown key, and `INVALID_ARGUMENT` for
an empty key or an invalid weight. A patch that changes nothing writes nothing.

### `enable`

```ts
enable(ctx, key: string): Promise<null>
```

Sets the flag's value to `true`. It does this on any flag, including a string or
number flag; use `define` or `update` for multivariate values. Throws
`FLAG_NOT_FOUND`.

### `disable`

```ts
disable(ctx, key: string): Promise<null>
```

Sets the flag's value to `false`, on any flag. Throws `FLAG_NOT_FOUND`.

### `archive`

```ts
archive(ctx, key: string): Promise<null>
```

Reversibly retires a flag. Evaluation then skips rules and rollout and serves
the base value with reason `disabled`; per-subject overrides still apply. The
flag stays in `list` and `all`. Throws `FLAG_NOT_FOUND`.

### `restore`

```ts
restore(ctx, key: string): Promise<null>
```

Returns an archived flag to active. Throws `FLAG_NOT_FOUND`.

### `remove`

```ts
remove(ctx, key: string): Promise<null>
```

Permanently deletes a flag and all of its per-subject overrides. Throws
`FLAG_NOT_FOUND`.

### `setOverride`

```ts
setOverride(ctx, key: string, subjectRef: string, value: VariantValue): Promise<null>
```

Forces the flag's value for one subject. The flag must exist (`FLAG_NOT_FOUND`);
`key` and `subjectRef` must be non-empty (`INVALID_ARGUMENT`). Setting it again
replaces the value. The value is not checked against the flag's `variants`.

### `clearOverride`

```ts
clearOverride(ctx, key: string, subjectRef: string): Promise<null>
```

Removes a subject's override. Does nothing when there is none, including for an
unknown flag. `key` and `subjectRef` must be non-empty (`INVALID_ARGUMENT`).

### `get`

```ts
get(ctx, key: string): Promise<FlagDoc | null>
```

One flag definition, or `null` for an unknown key.

### `list`

```ts
list(ctx): Promise<FlagDoc[]>
```

Every flag definition, active and archived, read in one query with no
pagination.

### `evaluate`

```ts
evaluate(ctx, key: string, options?: EvalOptions): Promise<FlagEvaluation>
```

Resolves a flag against `options.context` and returns `{ value, reason }`. See
[Evaluation order](#evaluation-order). An unknown key does not throw: it returns
`options.default` with reason `default`, or `false` with reason `unknown`.

### `variant`

```ts
variant(ctx, key: string, options?: EvalOptions): Promise<VariantValue>
```

Like `evaluate`, returning only the value.

### `isEnabled`

```ts
isEnabled(ctx, key: string, context?: EvalContext): Promise<boolean>
```

`true` when the evaluated value is exactly the boolean `true`; `false`
otherwise, including for unknown keys. It takes the context directly, not an
options object, and has no `default`.

### `all`

```ts
all(ctx, context?: EvalContext): Promise<Record<string, FlagEvaluation>>
```

Evaluates every defined flag against the same context, keyed by flag key: the
bootstrap payload for a reactive client. Overrides for `context.subjectRef` are
applied. Unknown keys are simply absent.

## Evaluation order

`evaluate`, `variant`, `isEnabled` and `all` resolve a flag in this order; the
first that applies wins:

1. **Override** — a per-subject override for `context.subjectRef` (reason
   `override`).
2. **Archived** — an archived flag serves its base value (reason `disabled`);
   rules and rollout are skipped. A flag with no `status` (a row written before
   `status` existed) is treated as active.
3. **Rules** — rules in order; the first whose conditions all match serves its
   `value` (reason `rule`), or else its `rollout` (reason `rollout`).
4. **Flag-level rollout** — when no rule matched (reason `rollout`).
5. **Flag value** — the base value (reason `flag`).

A rollout that cannot bucket (no `subjectRef` / `by` attribute in the context,
or no positive-weight split) yields no value, so the flag value is served with
reason `flag`. When that happens inside a matched rule, or the matched rule has
neither `value` nor `rollout`, evaluation stops there: later rules and the
flag-level rollout are not tried.

## Targeting operators

A condition is `{ attribute, op, values }`. A missing attribute never matches,
including `neq` and `nin`. Equality is strict (no string/number coercion);
`contains` is case-sensitive. There are no regex or prefix/suffix operators.

| Op                          | Holds when                                                |
| --------------------------- | --------------------------------------------------------- |
| `eq` / `neq`                | attribute equals / does not equal `values[0]`             |
| `in` / `nin`                | attribute is / is not in `values`                         |
| `contains`                  | string attribute contains the string `values[0]`          |
| `gt` / `gte` / `lt` / `lte` | numeric attribute compares against the number `values[0]` |

## Rollouts

A rollout distributes across weighted splits, bucketed deterministically by a
stable subject so a given subject always resolves to the same value:

```ts
const rollout = {
  splits: [
    { value: "A", weight: 50 },
    { value: "B", weight: 50 },
  ],
  by: "userId",
};
```

`by` names the context attribute to bucket by; when omitted,
`context.subjectRef` is used. The subject is hashed with 32-bit FNV-1a as
`"<flag key>:<subject>"`. Weights are relative to the sum of the positive
weights, and may be whole numbers (for example percentages) or decimals (`0.5` /
`0.5`); a `0` weight is never served. When every weight is a whole number, a
subject's bucket is its hash modulo that sum; when any weight is not a whole
number and the sum is finite, the hash modulo 1,000,000 is scaled into
`[0, sum)` instead. Splits are filled in order, so reordering them moves
subjects.

Upgrading from 0.1.0: rollouts whose weights are all whole numbers, and rows
stored with an `Infinity` weight before weights were validated, bucket exactly
as before. Other rollouts with a non-whole-number weight are re-bucketed once,
so some of their subjects change value. In 0.1.0 some of these weights bucketed
unevenly: weights summing to 1 (such as `0.5` / `0.5`) sent every subject to the
first split, other sets were skewed (`1.5` / `1.5` served about 67% / 33%), and
a split could get no subjects at all (`0.25` / `0.75` / `1` never served its
middle split).

## Types

`AttributeValue`, `EvalReason`, `Condition` and `Split` appear below for
reference and are not exported by name: derive them with
`FlagEvaluation["reason"]`, `Rule["conditions"][number]` and
`Rollout["splits"][number]`; `AttributeValue` is the same union as
`VariantValue`.

### `FlagsComponent`

```ts
interface FlagsComponent {
  mutations: {
    define;
    update;
    enable;
    disable;
    remove;
    archive;
    restore;
    setOverride;
    clearOverride;
  };
  queries: { get; list; evaluate; all };
}
```

The internal function references `Flags` calls. Pass `components.flags`; you do
not build this yourself.

### `FlagDefinition`

```ts
interface FlagDefinition {
  key: string;
  value: VariantValue;
  description?: string;
  variants?: Variant[];
  rules?: Rule[];
  rollout?: Rollout;
}
```

Argument of [`define`](#define).

### `FlagUpdate`

```ts
interface FlagUpdate {
  value?: VariantValue;
  description?: string;
  variants?: Variant[];
  rules?: Rule[];
  rollout?: Rollout;
}
```

Argument of [`update`](#update); the key is passed separately.

### `FlagDoc`

```ts
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
```

Returned by [`get`](#get) and [`list`](#list). A legacy row stored without a
status reads as `"active"`.

### `FlagEvaluation`

```ts
type EvalReason =
  "flag" | "rule" | "rollout" | "override" | "disabled" | "default" | "unknown";

interface FlagEvaluation {
  value: VariantValue;
  reason: EvalReason;
}
```

| Reason     | Served                                              |
| ---------- | --------------------------------------------------- |
| `flag`     | the flag's base value (no rule or rollout applied)  |
| `rule`     | a matched rule's `value`                            |
| `rollout`  | a split chosen by a rule's or the flag's rollout    |
| `override` | the subject's override                              |
| `disabled` | the base value of an archived flag                  |
| `default`  | the caller's `default` for an unknown key           |
| `unknown`  | `false` for an unknown key with no caller `default` |

Also exported from `@vllnt/convex-flags/react`.

### `EvalContext`

```ts
interface EvalContext {
  subjectRef?: string; // used for overrides and default rollout bucketing
  attributes?: Record<string, boolean | string | number>; // used by rule conditions and `by`
}
```

Supplied by the host on every call. Also exported from
`@vllnt/convex-flags/react`.

### `EvalOptions`

```ts
interface EvalOptions {
  context?: EvalContext;
  default?: VariantValue; // served (reason `default`) when the key is unknown
}
```

Options for [`evaluate`](#evaluate) and [`variant`](#variant). Only `context`
and `default` exist.

### `VariantValue`

```ts
type VariantValue = boolean | string | number;
```

Also exported from `@vllnt/convex-flags/react`.

### `Variant`

```ts
interface Variant {
  value: VariantValue;
  label?: string;
}
```

A declared variant. Metadata only: evaluation does not check served values
against `variants`.

### `Rule`

```ts
interface Condition {
  attribute: string;
  op: "eq" | "neq" | "in" | "nin" | "contains" | "gt" | "gte" | "lt" | "lte";
  values: Array<boolean | string | number>;
}

interface Rule {
  conditions: Condition[]; // AND; an empty list matches everyone
  value?: VariantValue; // wins over `rollout` when both are set
  rollout?: Rollout;
}
```

See [Targeting operators](#targeting-operators).

### `Rollout`

```ts
interface Split {
  value: VariantValue;
  weight: number; // finite and >= 0
}

interface Rollout {
  splits: Split[];
  by?: string; // context attribute to bucket by; default `subjectRef`
}
```

See [Rollouts](#rollouts).

## Error codes

| Code               | Thrown by                                                                                 | Condition                                                                                                    | Message                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `FLAG_NOT_FOUND`   | `update`, `enable`, `disable`, `archive`, `restore`, `remove`, `setOverride`              | The flag key does not exist                                                                                  | `FLAG_NOT_FOUND`                                                                                           |
| `INVALID_ARGUMENT` | every mutation (`key`); `setOverride`, `clearOverride` (`subjectRef`); `define`, `update` | `key` or `subjectRef` is empty, or a rollout weight (flag-level or in a rule) is `NaN`, infinite or negative | `key must be non-empty`, `subjectRef must be non-empty`, `rollout weights must be finite and non-negative` |

`FLAG_NOT_FOUND` is a plain JavaScript `Error("FLAG_NOT_FOUND")`, not a
structured `ConvexError` payload. `INVALID_ARGUMENT` is a `ConvexError` whose
`data` is `{ code: "INVALID_ARGUMENT", message }`. Convex hides plain error
messages from clients in production; do not depend on client-visible error text.

## React

Optional entry `@vllnt/convex-flags/react`. The hooks wrap `convex/react`'s
`useQuery` and take your own public query references; the component never
imports your `api`. A backend-only consumer never imports this entry.

### `useFlag`

```ts
import type {
  EvaluateRef,
  FlagEvaluation,
  UseFlagOptions,
} from "@vllnt/convex-flags/react";

useFlag(
  query: EvaluateRef,
  key: string,
  options?: UseFlagOptions,
): FlagEvaluation | undefined
```

Returns `undefined` while loading, then `{ value, reason }`; re-renders when the
result changes.

### `useFlags`

```ts
import type {
  AllRef,
  EvalContext,
  FlagEvaluation,
} from "@vllnt/convex-flags/react";

useFlags(
  query: AllRef,
  context?: EvalContext,
): Record<string, FlagEvaluation> | undefined
```

Returns `undefined` while loading, then a map of flag key to
`{ value, reason }`.

### `UseFlagOptions`

```ts
interface UseFlagOptions {
  context?: EvalContext;
  default?: VariantValue; // served (reason `default`) when the key is unknown
}
```

### `EvaluateRef`

```ts
type EvaluateRef = FunctionReference<
  "query",
  "public",
  { key: string; context?: EvalContext; default?: VariantValue },
  FlagEvaluation
>;
```

A public query with the args and result of [`evaluate`](#evaluate), typically a
wrapper that calls it.

### `AllRef`

```ts
type AllRef = FunctionReference<
  "query",
  "public",
  { context?: EvalContext },
  Record<string, FlagEvaluation>
>;
```

A public query with the args and result of [`all`](#all), typically a wrapper
that calls it.

## Component config

### `convex.config`

```ts
import flags from "@vllnt/convex-flags/convex.config";
```

The default export is the component definition (`defineComponent("flags")`).
Mount it with `app.use(flags)`, or `app.use(flags, { name })` once per named
mount. Each mount has its own `flags` and `overrides` tables. The component has
no crons, actions or child components.

### `ComponentApi`

```ts
import type { ComponentApi } from "@vllnt/convex-flags/_generated/component";
```

Generated type of the mounted component's internal functions (`mutations.*`,
`queries.*`). `components.flags` in the host has this type, and it is assignable
to [`FlagsComponent`](#flagscomponent).

## Testing

### `register`

```ts
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";

register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name = "flags",
): void
```

Registers the component with a `convex-test` instance under `name` (pass the
mount name if you used `app.use(flags, { name })`). `t` can be built from a host
schema with its own tables. The helper ships as TypeScript source and uses
Vite's `import.meta.glob`, so it needs Vitest (or another Vite-based runner)
plus `convex-test`.
