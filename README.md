<!-- Badges -->
[![Convex Component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://www.convex.dev/components)
[![npm](https://img.shields.io/npm/v/@vllnt/convex-flags.svg)](https://www.npmjs.com/package/@vllnt/convex-flags)
[![CI](https://img.shields.io/github/actions/workflow/status/vllnt/convex-flags/ci.yml?branch=main&label=CI)](https://github.com/vllnt/convex-flags/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-flags.svg)](./LICENSE)

# @vllnt/convex-flags

Feature flags as a **Convex component**. Boolean kill-switches evaluated on the
backend and streamed to every connected client in real time over Convex's reactive
queries. Flip a flag → clients update instantly. No redeploy, no polling, no
third-party flag SaaS.

> **Status (v0.1.0):** the shipped surface is the boolean core below. Sections
> tagged **[planned]** are the roadmap, not yet implemented.

```ts
// backend
const enabled = await flags.isEnabled(ctx, "new-checkout");
```

---

## Features

- **Boolean kill-switches** — backend-evaluated, reactive, streamed to clients
- **Data isolation** — flag definitions live in the component's own sandboxed
  `flags` table; no name collisions, no blast radius into your schema
- **Reuse** — mount into any Convex backend with one `app.use()`
- **Real-time** — evaluation runs in a Convex query; flag changes propagate
  through the same subscription mechanism as your app data
- **Dual-target** — runs unchanged on Convex Cloud and self-hosted
  `convex-backend`; code never branches on the host
- **Auth-agnostic** — the component is domain- and auth-neutral; the host gates
  every management call

---

## Architecture

```
src/
├── shared.ts              # EVAL_REASON codes + FlagEvaluation type
├── test.ts                # convex-test registration helper (./test)
├── client/
│   ├── types.ts           # FlagDoc, FlagDefinition interfaces
│   └── index.ts           # Flags client class — the consumer-facing API
└── component/
    ├── schema.ts           # flags table (by_key index)
    ├── convex.config.ts    # defineComponent("flags")
    ├── mutations.ts        # define, enable, disable, remove
    ├── queries.ts          # get, list, evaluate, all
    └── validators.ts       # flagFields, flagDoc, evaluation validators
```

---

## Installation

```bash
npm install @vllnt/convex-flags
```

Register the component in your app's `convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import flags from "@vllnt/convex-flags/convex.config";

const app = defineApp();
app.use(flags);
export default app;
```

Instantiate the client once and re-export it:

```ts
// convex/flags.ts
import { Flags } from "@vllnt/convex-flags";
import { components } from "./_generated/api";

export const flags = new Flags(components.flags);
```

---

## Usage

### Defining flags

Flags are data. Create them from your own authorized mutations or a seed script.
The host owns auth — gate the management methods behind your own access checks.

```ts
await flags.define(ctx, {
  key: "new-checkout",
  value: false,
  description: "Routes traffic to the rebuilt checkout flow",
});
```

### Enabling / disabling

```ts
await flags.enable(ctx, "new-checkout");   // set true
await flags.disable(ctx, "new-checkout");  // set false
```

### Evaluating flags

Call the client inside any query, mutation, or action:

```ts
import { query } from "./_generated/server";
import { flags } from "./flags";

export const checkout = query({
  args: {},
  handler: async (ctx) => {
    if (await flags.isEnabled(ctx, "new-checkout")) {
      return loadNewCheckout(ctx);
    }
    return loadLegacyCheckout(ctx);
  },
});
```

### How evaluation works

```
evaluate(key)
      │
      ▼
┌──────────────────────────────┐
│ flag exists & value is true?  │── no ──▶ false   (reason: "unknown" or "flag")
└──────────────┬───────────────┘
               │ yes
               ▼
          true                              (reason: "flag")
```

### Environment targeting [planned]

Per-environment rules (`development` / `staging` / `production`) keyed via
`CONVEX_FLAGS_ENV` are planned. The targeting environment is a logical concept
independent of where the backend runs — same code on Convex Cloud and self-hosted
`convex-backend`.

---

## API Reference

See [`docs/API.md`](docs/API.md) for the full reference.

### `Flags` — evaluation

| Method | Returns | Purpose |
|--------|---------|---------|
| `isEnabled(ctx, key)` | `boolean` | Boolean flag value; `false` for undefined keys |
| `evaluate(ctx, key)` | `FlagEvaluation` | Full result with `value` and `reason` |
| `get(ctx, key)` | `FlagDoc \| null` | Fetch a single flag definition |
| `list(ctx)` | `FlagDoc[]` | Every flag definition |
| `all(ctx)` | `Record<string, FlagEvaluation>` | Bootstrap payload for a reactive client |

### `Flags` — management (host gates access)

| Method | Purpose |
|--------|---------|
| `define(ctx, definition)` | Create or update a flag |
| `enable(ctx, key)` | Set flag value to `true` |
| `disable(ctx, key)` | Set flag value to `false` |
| `remove(ctx, key)` | Hard-delete a flag |

### [planned] Multivariate variants

`variant(ctx, key, context?)`, `get(ctx, key, context?)`,
`evaluate(ctx, key, context?)` with typed `EvalContext` — planned.

### [planned] Percentage rollouts and attribute targeting

`setRules(ctx, key, env, rules)` with `rollout`, `userIds`, `attributes` conditions — planned.

### [planned] React hooks

`FlagsProvider`, `useFlag`, `useVariant`, `useFlagValue`, `useFlags` via
`@vllnt/convex-flags/react` — planned.

---

## Security Model

`@vllnt/convex-flags` is auth-agnostic. The component owns only its sandboxed
`flags` table and exposes all management mutations as internal Convex functions.
The host controls access.

- **Who may call `define` / `enable` / `disable` / `remove`:** only the host,
  via `ctx.runMutation(components.flags.mutations.define, ...)`. Wrap these in
  your own authorized mutations and apply your auth checks there.
- **Read (`get`, `list`, `evaluate`, `all`):** similarly internal; the host
  exposes a public query only if it chooses to.
- **Opaque keys:** flag keys are host-chosen strings. The component stores and
  returns them as-is; it never interprets or validates key structure.
- **No cross-table access:** the component never reads host or sibling tables.

---

## Testing

Backend logic is covered with `convex-test` (in-process, no running backend):

```ts
import { convexTest } from "convex-test";
import { test, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { registerFlags } from "@vllnt/convex-flags/test";

test("enabled flag returns true", async () => {
  const t = convexTest(schema);
  registerFlags(t, "flags");

  await t.mutation(api.example.defineAndEnable, { key: "my-flag" });
  expect(await t.query(api.example.isEnabled, { key: "my-flag" })).toBe(true);
});
```

Coverage is enforced at 100% for all included source files — see
`vitest.config.mts`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Author

Built by [bntvllnt](https://github.com/bntvllnt) · [bntvllnt.com](https://bntvllnt.com) · [X @bntvllnt](https://x.com/bntvllnt)

Part of the [@vllnt](https://github.com/vllnt) Convex component fleet — [vllnt.com](https://vllnt.com)

If this is useful, [sponsor the work](https://github.com/sponsors/bntvllnt).

---

## License

MIT
