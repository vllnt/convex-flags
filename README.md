# @vllnt/convex-flags

Convex component for feature flags in TypeScript: kill switches, variants,
attribute targeting, percentage rollouts, per-subject overrides and React hooks.

## For coding agents

Docs for the installed version are in `node_modules/@vllnt/convex-flags/`:
`docs/API.md`, `llms.txt`, `CHANGELOG.md` and the TypeScript `src/`. Read them
before writing code against this package.

## When to use

- Use it when a Convex app needs on/off switches it can flip without a deploy.
- Use it when a feature goes to a percentage of users, or to users whose
  attributes match rules, and each user must keep the same value.
- Use it when clients must see a flag change live through a Convex query.
- Do not use it when you run an A/B experiment and need sticky assignments and
  exposure counts per variant: use
  [`@vllnt/convex-experiments`](https://oss.vllnt.com/packages/convex-experiments).
- Do not use it when you need to measure what a flagged feature did (events,
  funnels, retention): use
  [`@vllnt/convex-analytics`](https://oss.vllnt.com/packages/convex-analytics).

## Install

```bash
npm install @vllnt/convex-flags convex
```

## Quick start

```ts
// convex/convex.config.ts
import flags from "@vllnt/convex-flags/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(flags);
export default app;
```

```ts
// convex/flags.ts
import { Flags } from "@vllnt/convex-flags";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";

export const flags = new Flags(components.flags);

export const createNewCheckout = internalMutation({
  args: {},
  returns: v.string(),
  handler: (ctx) => flags.define(ctx, { key: "new-checkout", value: false }),
});

export const turnOnNewCheckout = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => flags.enable(ctx, "new-checkout"),
});

export const newCheckoutOn = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    return flags.isEnabled(ctx, "new-checkout", {
      subjectRef: user?.tokenIdentifier,
    });
  },
});
```

Run `npx convex dev` once to generate `components.flags`, then
`npx convex run flags:createNewCheckout` and
`npx convex run flags:turnOnNewCheckout`. `newCheckoutOn` re-runs for every
subscribed client when the flag changes. The component never reads auth: the
management functions above are internal, and the host decides who may call them.

## API

Full reference: [docs/API.md](docs/API.md).

| Export                                                                | Import from                                | What it does                                                        |
| --------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| [`Flags`](docs/API.md#flags)                                          | `@vllnt/convex-flags`                      | Host client: `new Flags(components.flags)`                          |
| [`define(ctx, definition)`](docs/API.md#define)                       | `Flags` method, mutation                   | Create a flag, or fully replace its definition; returns the flag id |
| [`update(ctx, key, patch)`](docs/API.md#update)                       | `Flags` method, mutation                   | Change only the supplied fields of a flag                           |
| [`enable(ctx, key)`](docs/API.md#enable)                              | `Flags` method, mutation                   | Set the flag's value to `true`                                      |
| [`disable(ctx, key)`](docs/API.md#disable)                            | `Flags` method, mutation                   | Set the flag's value to `false`                                     |
| [`archive(ctx, key)`](docs/API.md#archive)                            | `Flags` method, mutation                   | Retire a flag: serve its base value, skip rules and rollout         |
| [`restore(ctx, key)`](docs/API.md#restore)                            | `Flags` method, mutation                   | Make an archived flag active again                                  |
| [`remove(ctx, key)`](docs/API.md#remove)                              | `Flags` method, mutation                   | Delete a flag and its overrides                                     |
| [`setOverride(ctx, key, subjectRef, value)`](docs/API.md#setoverride) | `Flags` method, mutation                   | Force one subject's value for a flag                                |
| [`clearOverride(ctx, key, subjectRef)`](docs/API.md#clearoverride)    | `Flags` method, mutation                   | Remove one subject's override                                       |
| [`get(ctx, key)`](docs/API.md#get)                                    | `Flags` method, query                      | One flag definition, or `null`                                      |
| [`list(ctx)`](docs/API.md#list)                                       | `Flags` method, query                      | Every flag definition                                               |
| [`evaluate(ctx, key, options?)`](docs/API.md#evaluate)                | `Flags` method, query                      | `{ value, reason }` for one flag and context                        |
| [`variant(ctx, key, options?)`](docs/API.md#variant)                  | `Flags` method, query                      | The evaluated value only                                            |
| [`isEnabled(ctx, key, context?)`](docs/API.md#isenabled)              | `Flags` method, query                      | `true` only when the evaluated value is exactly `true`              |
| [`all(ctx, context?)`](docs/API.md#all)                               | `Flags` method, query                      | `{ value, reason }` for every flag, keyed by flag key               |
| [`FlagsComponent`](docs/API.md#flagscomponent)                        | `@vllnt/convex-flags` (type)               | Type of `components.flags` the client accepts                       |
| [`FlagDefinition`](docs/API.md#flagdefinition)                        | `@vllnt/convex-flags` (type)               | Argument of `define`                                                |
| [`FlagUpdate`](docs/API.md#flagupdate)                                | `@vllnt/convex-flags` (type)               | Argument of `update`                                                |
| [`FlagDoc`](docs/API.md#flagdoc)                                      | `@vllnt/convex-flags` (type)               | A stored flag as returned by `get` and `list`                       |
| [`FlagEvaluation`](docs/API.md#flagevaluation)                        | `@vllnt/convex-flags`, `/react` (type)     | `{ value, reason }`                                                 |
| [`EvalContext`](docs/API.md#evalcontext)                              | `@vllnt/convex-flags`, `/react` (type)     | `{ subjectRef?, attributes? }` used for targeting and bucketing     |
| [`EvalOptions`](docs/API.md#evaloptions)                              | `@vllnt/convex-flags` (type)               | `{ context?, default? }` for `evaluate` and `variant`               |
| [`VariantValue`](docs/API.md#variantvalue)                            | `@vllnt/convex-flags`, `/react` (type)     | `boolean \| string \| number`                                       |
| [`Variant`](docs/API.md#variant-1)                                    | `@vllnt/convex-flags` (type)               | Declared variant: `{ value, label? }` (metadata only)               |
| [`Rule`](docs/API.md#rule)                                            | `@vllnt/convex-flags` (type)               | Targeting rule: conditions, then a `value` or a `rollout`           |
| [`Rollout`](docs/API.md#rollout)                                      | `@vllnt/convex-flags` (type)               | Weighted splits, bucketed by `subjectRef` or a `by` attribute       |
| [`useFlag`](docs/API.md#useflag)                                      | `@vllnt/convex-flags/react`                | Reactive `{ value, reason }` for one flag over your own query       |
| [`useFlags`](docs/API.md#useflags)                                    | `@vllnt/convex-flags/react`                | Reactive map of every flag over your own query                      |
| [`UseFlagOptions`](docs/API.md#useflagoptions)                        | `@vllnt/convex-flags/react` (type)         | `{ context?, default? }` for `useFlag`                              |
| [`EvaluateRef`](docs/API.md#evaluateref)                              | `@vllnt/convex-flags/react` (type)         | Query reference shape `useFlag` accepts                             |
| [`AllRef`](docs/API.md#allref)                                        | `@vllnt/convex-flags/react` (type)         | Query reference shape `useFlags` accepts                            |
| [`default` (component config)](docs/API.md#convexconfig)              | `@vllnt/convex-flags/convex.config`        | Pass to `app.use(...)`                                              |
| [`register`](docs/API.md#register)                                    | `@vllnt/convex-flags/test`                 | Mount the component in `convex-test`                                |
| [`ComponentApi`](docs/API.md#componentapi)                            | `@vllnt/convex-flags/_generated/component` | Generated type of the mounted component                             |

## Common tasks

Read flags from React. The hooks take your own public queries. Here the server
sets `subjectRef` from auth and ignores any `subjectRef` the client sends;
`attributes` still come from the client, so do not target on them for access
decisions:

```ts
// convex/flagQueries.ts
import { v } from "convex/values";

import { query } from "./_generated/server";
import { flags } from "./flags";

const value = v.union(v.boolean(), v.string(), v.number());
const context = v.object({
  subjectRef: v.optional(v.string()),
  attributes: v.optional(v.record(v.string(), value)),
});
const evaluation = v.object({
  value,
  reason: v.union(
    v.literal("flag"),
    v.literal("rule"),
    v.literal("rollout"),
    v.literal("override"),
    v.literal("disabled"),
    v.literal("default"),
    v.literal("unknown"),
  ),
});

export const evaluate = query({
  args: {
    key: v.string(),
    context: v.optional(context),
    default: v.optional(value),
  },
  returns: evaluation,
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    return flags.evaluate(ctx, args.key, {
      context: {
        subjectRef: user?.tokenIdentifier,
        attributes: args.context?.attributes,
      },
      default: args.default,
    });
  },
});

export const all = query({
  args: { context: v.optional(context) },
  returns: v.record(v.string(), evaluation),
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    return flags.all(ctx, {
      subjectRef: user?.tokenIdentifier,
      attributes: args.context?.attributes,
    });
  },
});
```

```tsx
// src/Checkout.tsx
import { useFlag, useFlags } from "@vllnt/convex-flags/react";

import { api } from "../convex/_generated/api";

export function Checkout({ plan }: { plan: string }) {
  const checkout = useFlag(api.flagQueries.evaluate, "new-checkout", {
    context: { attributes: { plan } },
  });
  const everything = useFlags(api.flagQueries.all);
  if (checkout === undefined || everything === undefined) return <p>Loading</p>;
  const label = checkout.value === true ? "New checkout" : "Classic checkout";
  const count = Object.keys(everything).length;
  return (
    <p>{`${label} (reason: ${checkout.reason}, ${String(count)} flags)`}</p>
  );
}
```

Target by attributes and roll out by percentage. Pro users always get the new
checkout; everyone else is split 10% / 90% by `subjectRef`:

```ts
// convex/rollout.ts
import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { flags } from "./flags";

export const setUpRollout = internalMutation({
  args: {},
  returns: v.string(),
  handler: (ctx) =>
    flags.define(ctx, {
      key: "new-checkout",
      value: false,
      rules: [
        {
          conditions: [{ attribute: "plan", op: "eq", values: ["pro"] }],
          value: true,
        },
      ],
      rollout: {
        splits: [
          { value: true, weight: 10 },
          { value: false, weight: 90 },
        ],
      },
    }),
});

export const checkoutFor = query({
  args: { plan: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { plan }) => {
    const user = await ctx.auth.getUserIdentity();
    return flags.isEnabled(ctx, "new-checkout", {
      subjectRef: user?.tokenIdentifier,
      attributes: { plan },
    });
  },
});
```

Serve a string variant, bucketed by an attribute so every user in one team gets
the same value, and change one field later without touching the rest:

```ts
// convex/layout.ts
import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { flags } from "./flags";

export const setUpLayout = internalMutation({
  args: {},
  returns: v.string(),
  handler: (ctx) =>
    flags.define(ctx, {
      key: "checkout-layout",
      value: "one-page",
      variants: [
        { value: "one-page", label: "One page" },
        { value: "steps", label: "Three steps" },
      ],
      rollout: {
        by: "teamId",
        splits: [
          { value: "one-page", weight: 50 },
          { value: "steps", weight: 50 },
        ],
      },
    }),
});

export const describeLayout = internalMutation({
  args: { description: v.string() },
  returns: v.null(),
  handler: (ctx, { description }) =>
    flags.update(ctx, "checkout-layout", { description }),
});

export const layoutFor = query({
  args: { teamId: v.string() },
  returns: v.string(),
  handler: async (ctx, { teamId }) => {
    const layout = await flags.variant(ctx, "checkout-layout", {
      context: { attributes: { teamId } },
      default: "one-page",
    });
    return typeof layout === "string" ? layout : "one-page";
  },
});
```

Force a value for one subject (support, QA), switch a flag off, retire it, bring
it back, delete it, and list the defined keys:

```ts
// convex/admin.ts
import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import { flags } from "./flags";

export const forceOn = internalMutation({
  args: { subjectRef: v.string() },
  returns: v.null(),
  handler: (ctx, { subjectRef }) =>
    flags.setOverride(ctx, "new-checkout", subjectRef, true),
});

export const unforce = internalMutation({
  args: { subjectRef: v.string() },
  returns: v.null(),
  handler: (ctx, { subjectRef }) =>
    flags.clearOverride(ctx, "new-checkout", subjectRef),
});

export const killSwitch = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => flags.disable(ctx, "new-checkout"),
});

export const retire = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => flags.archive(ctx, "new-checkout"),
});

export const bringBack = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => flags.restore(ctx, "new-checkout"),
});

export const deleteForGood = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) => flags.remove(ctx, "new-checkout"),
});

export const flagKeys = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => (await flags.list(ctx)).map((flag) => flag.key),
});
```

Mount the component twice for two separate sets of flags. Each named mount has
its own tables:

```ts
// convex/convex.config.ts
import flags from "@vllnt/convex-flags/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(flags, { name: "webFlags" });
app.use(flags, { name: "mobileFlags" });
export default app;
```

```ts
// convex/clients.ts
import { Flags } from "@vllnt/convex-flags";

import { components } from "./_generated/api";

export const webFlags = new Flags(components.webFlags);
export const mobileFlags = new Flags(components.mobileFlags);
```

## Errors and fixes

Management methods throw these errors from the component. Reads (`get`, `list`,
`evaluate`, `variant`, `isEnabled`, `all`) never throw them.

| Code               | Message                                                                                                    | Cause                                                                                                                                                                                                   | Fix                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `FLAG_NOT_FOUND`   | contains `FLAG_NOT_FOUND` (a plain `Error`)                                                                | `update`, `enable`, `disable`, `archive`, `restore`, `remove` or `setOverride` got a key that was never defined, or was removed                                                                         | Call `define` first, or check with `get(ctx, key)`; keys are case-sensitive |
| `INVALID_ARGUMENT` | `key must be non-empty`, `subjectRef must be non-empty`, `rollout weights must be finite and non-negative` | A management method got an empty `key`; `setOverride` / `clearOverride` got an empty `subjectRef`; `define` / `update` got a split weight that is `NaN`, infinite or negative (flag-level or in a rule) | Pass non-empty strings; use weights `>= 0` (a `0` weight turns a split off) |

`INVALID_ARGUMENT` is a `ConvexError` whose `data` is `{ code, message }`: read
`error.data.code`. `FLAG_NOT_FOUND` is a plain `Error` whose message contains
`FLAG_NOT_FOUND`. Convex hides the message of a plain `Error` from clients in
production, so catch it in your host mutation and rethrow a `ConvexError` if the
client must see it. Arguments of the wrong type (for example an object as
`value`) are rejected by Convex argument validation before the component runs.

## Limits and gotchas

- Unknown keys do not throw on read. `evaluate` returns your `default` (reason
  `default`) or `false` (reason `unknown`); `isEnabled` returns `false`; `all`
  leaves the key out. A misspelled key silently reads as off.
- `isEnabled` is `true` only for the boolean `true`; a string `"true"` or the
  number `1` reads as `false`.
- Evaluation order: per-subject override, then archived, then rules in order
  (first match wins), then the flag-level rollout, then the flag's `value`.
- Archived means disabled: an archived flag serves its base `value` with reason
  `disabled` and skips rules and rollout. Overrides still win over archiving.
  Archived flags stay in `list` and `all`; `restore` makes them active again.
- Rollout bucketing is deterministic: the subject is `context.subjectRef`, or
  `String(context.attributes[by])` when the rollout sets `by`. The bucket is the
  32-bit FNV-1a hash of `"<flag key>:<subject>"`, so one subject gets the same
  value on every read while the rollout is unchanged, and can land in different
  splits of different flags. Renaming the key, reordering splits or changing
  weights can move subjects.
- Weights are relative to the sum of the positive weights; a `0` weight is never
  served. With whole-number weights the bucket is `hash % sum`; when any weight
  is not a whole number, `hash % 1,000,000` is scaled into `[0, sum)`.
- Upgrading from 0.1.0: rollouts with a non-whole-number weight are re-bucketed
  once, so some of their subjects change value. In 0.1.0 weights such as `0.5` /
  `0.5` sent every subject to the first split. Rollouts whose weights are all
  whole numbers, and rows stored with an `Infinity` weight before weights were
  validated, bucket as before.
- A rollout with no subject (no `subjectRef`, or the `by` attribute missing) or
  no positive weight serves the flag's `value` with reason `flag`. Inside a
  matched rule this also stops evaluation: later rules and the flag-level
  rollout are not tried. A matched rule with neither `value` nor `rollout` does
  the same. A rule's `value` wins over its `rollout`.
- Conditions: a missing attribute never matches, not even `neq` or `nin`.
  Equality is strict (`"1"` is not `1`). `contains` is case-sensitive and
  strings only; `gt`, `gte`, `lt`, `lte` compare numbers only. `eq`, `neq`,
  `contains` and the comparisons read only `values[0]`. A rule with no
  conditions matches everyone.
- Overrides apply only when the context has a `subjectRef`. Override values and
  rule values are not checked against `variants`, which are labels only.
- `define` replaces the whole definition: fields you leave out are cleared, and
  the status (active or archived) is kept. `update` cannot clear a field,
  because an omitted or `undefined` field is ignored; use `define`, or pass an
  empty value such as `rules: []`.
- `enable` and `disable` write `true` / `false` even on a string or number flag.
- Writes that change nothing are skipped, so `updatedAt` stays and subscribed
  queries do not re-run.
- `clearOverride` on a missing override or flag does nothing. `remove` deletes
  the flag's overrides too.
- `all` (and so `useFlags`) returns a record keyed by flag key, and Convex
  rejects record keys that start with `$` or `_`, contain a character outside
  printable ASCII (such as `é` or a tab), or are longer than 1024 characters.
  `define` accepts such a key, and `get` and `evaluate` serve it, but every
  `all` call then fails while that flag exists, for all flags. Example:
  `Field name café has invalid character 'é': Field names can only contain non-control ASCII characters`.
  The `$`, non-ASCII, control-character and length cases were reproduced in
  `convex-test`; the `_` rule is Convex's documented record-key rule and was not
  reproduced there. Use printable ASCII keys of at most 1024 characters that do
  not start with `$` or `_`.
- `all` returns one field per flag, and Convex limits an object to 1024 fields,
  so with more than 1024 flags `all` and `useFlags` fail (Convex's documented
  limit, not tested here). Use `evaluate` per key for larger sets. `list` and
  `all` also read every flag in one query, with no pagination.
- Evaluation is a query and writes nothing: there is no evaluation log, no
  stale-flag detection and no change history.

## Compatibility

- Peer dependencies: `convex@^1.45.0`; `react@^18.0.0 || ^19.0.0` (optional,
  only for `@vllnt/convex-flags/react`). CI runs the unit tests on the locked
  convex version (1.51.0), and type-checks and runs the packed package against
  convex 1.45.0 and React 18.
- Node.js 20 or newer; convex 1.49 and newer needs Node.js 22 or newer. ES
  modules only.
- Runtime: the component's functions are Convex queries and mutations in the
  default Convex runtime, with no actions, crons, HTTP routes or network calls.
  The client methods run in host queries, mutations and actions; the mutation
  methods need `runMutation` (a mutation or action context). CI does not run
  against a self-hosted Convex backend.
- `@vllnt/convex-flags/test` ships as TypeScript source and needs `convex-test`,
  `vitest`, `vite` and `@edge-runtime/vm`, with the Vitest config shown under
  Testing. `convex-test` 0.0.72 and newer require convex `^1.46.0`; on convex
  1.45 use `convex-test` 0.0.56 to 0.0.71. The packed-package check uses convex
  1.45.0 with `convex-test` 0.0.56.

## Testing

### Testing your app

Mount the component in your own `convex-test` suite with `register`. Use the
Vitest settings `convex-test` recommends (edge runtime, `convex-test` inlined).
`register` uses Vite's `import.meta.glob`, so it only works under Vitest/Vite:

```ts
// vitest.config.mts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

```ts
// convex/flags.test.ts
/// <reference types="vite/client" />
import { register } from "@vllnt/convex-flags/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

test("the new checkout turns on", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  register(t);
  await t.mutation(internal.flags.createNewCheckout, {});
  expect(await t.query(api.flags.newCheckoutOn, {})).toBe(false);
  await t.mutation(internal.flags.turnOnNewCheckout, {});
  expect(await t.query(api.flags.newCheckoutOn, {})).toBe(true);
});
```

`register(t, name)` takes the mount name when you used
`app.use(flags, { name })`. It accepts a `convexTest` instance built from a host
schema with its own tables.

### This repository

`pnpm test:coverage` runs the tests on the simulated `convex-test` runtime with
100% coverage enforced. `pnpm test:package` installs the packed tarball in a
temporary app and checks these docs. It type-checks every README `ts` and `tsx`
example and the `docs/API.md` signatures of `register`, `useFlag` and
`useFlags`, and runs only the README test example (`convex/flags.test.ts`).

## Security

- The component does not authenticate. Its management functions are internal;
  wrap them in your own mutations and authorize there.
- A flag is not an access check. Context sent by a client (`subjectRef`,
  `attributes`) can be forged; derive identity and attributes on the server when
  targeting matters.
- Its `flags` and `overrides` tables are reachable only through the component's
  functions, and it never reads host tables.
- Flag keys, subject refs and attribute names are opaque strings. On writes the
  component rejects only empty keys and subject refs; it does not check a key's
  characters or length (see Limits and gotchas for keys that break `all`).

Report vulnerabilities as described in
[SECURITY.md](https://github.com/vllnt/convex-flags/blob/main/SECURITY.md).

## Related packages

None: no runtime or peer dependency, shared test or example uses another
`@vllnt` package.

## Contributing

See
[CONTRIBUTING.md](https://github.com/vllnt/convex-flags/blob/main/CONTRIBUTING.md).

## Links

- Docs and changelog: [oss.vllnt.com/packages/convex-flags](https://oss.vllnt.com/packages/convex-flags) · [release feed](https://oss.vllnt.com/packages/convex-flags/rss.xml)
- All @vllnt packages: [oss.vllnt.com](https://oss.vllnt.com) · [search packages and docs on index.vllnt.com](https://index.vllnt.com)
- Source and issues: [GitHub](https://github.com/vllnt/convex-flags) · [issues](https://github.com/vllnt/convex-flags/issues) · [npm](https://www.npmjs.com/package/@vllnt/convex-flags)
- Questions and updates: [Discord](https://bntvllnt.com/discord) · [X @bntvllnt](https://x.com/bntvllnt)
- Company and author: [vllnt.com](https://vllnt.com) · [bntvllnt.com](https://bntvllnt.com) · [GitHub @bntvllnt](https://github.com/bntvllnt) · [LinkedIn](https://linkedin.com/in/bntvllnt)
- Sponsor: [GitHub Sponsors](https://github.com/sponsors/bntvllnt)

## License

MIT. See [LICENSE](LICENSE).

[![npm](https://img.shields.io/npm/v/@vllnt/convex-flags.svg)](https://www.npmjs.com/package/@vllnt/convex-flags)
[![CI](https://github.com/vllnt/convex-flags/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-flags/actions/workflows/ci.yml)

---

Part of [vllnt open source](https://oss.vllnt.com) · [Package page](https://oss.vllnt.com/packages/convex-flags) · [vllnt.com](https://vllnt.com) · Built by [bntvllnt](https://bntvllnt.com)
