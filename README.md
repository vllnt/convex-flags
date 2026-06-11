# @vllnt/convex-flags

[![npm](https://img.shields.io/npm/v/@vllnt/convex-flags.svg)](https://www.npmjs.com/package/@vllnt/convex-flags)
[![license](https://img.shields.io/npm/l/@vllnt/convex-flags.svg)](./LICENSE)

Feature flags as a **Convex component**. Boolean kill-switches, multivariate
experiments, percentage rollouts, and attribute targeting — evaluated on the
backend, streamed to the client in real time over Convex's reactive queries.

Flip a flag → every connected client updates instantly. No redeploy, no polling,
no third-party flag SaaS.

```ts
// backend
const enabled = await flags.isEnabled(ctx, "new-checkout", { userId });
const cta = await flags.variant(ctx, "hero-cta", { userId });   // "a" | "b" | "control"
```

```tsx
// frontend — reactive, updates live when a rule changes
const enabled = useFlag("new-checkout");
const cta = useVariant("hero-cta");
```

---

## Why a component

- **Data isolation** — flag definitions, rules, and audit rows live in the
  component's own tables, sandboxed from your app schema. No name collisions, no
  blast radius into your data.
- **Reuse** — mount it into any Convex backend with one `app.use()`.
- **Real-time** — evaluation runs in a Convex query, so flag changes propagate to
  clients through the same subscription mechanism as your app data.
- **Dual-target** — runs unchanged on Convex Cloud and self-hosted
  `convex-backend`. Code never branches on the host.

---

## Installation

```bash
npm install @vllnt/convex-flags
```

Register the component in your app's `convex.config.ts`:

```ts
// convex/convex.config.ts
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

export const flags = new Flags(components.flags, {
  // Targeting environment for this deployment. Logical only — never the host.
  environment: process.env.CONVEX_FLAGS_ENV ?? "production",
});
```

---

## How evaluation works

Every read resolves to a value through a deterministic, top-down pass. First
matching rule wins; otherwise the flag's defined default is served.

```
evaluate(key, context)
        │
        ▼
┌──────────────────────────────┐
│ flag exists & enabled         │── no ──▶ default value   (reason: "disabled")
│ for this environment?         │
└──────────────┬───────────────┘
               │ yes
               ▼
┌──────────────────────────────┐
│ rules, in order:              │
│   rule 1  conditions + rollout│── hit ─▶ rule value      (reason: "rule:0")
│   rule 2  conditions + rollout│── hit ─▶ rule value      (reason: "rule:1")
│   ...                         │
└──────────────┬───────────────┘
               │ no rule hit
               ▼
          default value                                    (reason: "default")
```

**Rollout is deterministic.** The same `userId` (or hash seed) always lands on the
same side of a percentage gate, so a user's experience is stable across requests
and sessions — and ramping 10% → 50% never reshuffles the first 10%.

---

## Defining flags

Flags are data. Define and target them from your own mutations (wrap the
management methods behind your auth) or a seed script.

```ts
// Boolean kill-switch
await flags.define(ctx, {
  key: "new-checkout",
  type: "boolean",
  description: "Routes traffic to the rebuilt checkout flow",
  default: false,
});

// Multivariate experiment
await flags.define(ctx, {
  key: "hero-cta",
  type: "variant",
  variants: ["a", "b", "control"],
  default: "control",
});
```

Attach targeting rules per environment (ordered, first match wins):

```ts
await flags.setRules(ctx, "new-checkout", "production", [
  // 1. Always on for internal users
  { userIds: ["u_alice", "u_bob"], value: true },

  // 2. On for every Pro-plan account
  { attributes: { plan: { eq: "pro" } }, value: true },

  // 3. Ramp to 25% of everyone else, keyed by userId
  { rollout: 25, value: true },
]);
```

A rule matches when **all** its conditions hold and it passes its `rollout` gate.
Omit conditions to match everyone; omit `rollout` to apply to 100% of the matched
cohort.

---

## Reading flags

### Backend

Call the client inside any query, mutation, or action. Pass an evaluation
context so targeting and rollout can resolve.

```ts
import { query } from "./_generated/server";
import { flags } from "./flags";

export const checkout = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const context = { userId, attributes: { plan: "pro" } };

    if (await flags.isEnabled(ctx, "new-checkout", context)) {
      return loadNewCheckout(ctx);
    }
    return loadLegacyCheckout(ctx);
  },
});
```

### Frontend (React)

Expose one public query that evaluates every flag for the current context…

```ts
// convex/flags.ts
import { query } from "./_generated/server";
import { flags } from "./flags";

export const evaluateAll = query({
  args: { context: flags.contextValidator },
  handler: (ctx, { context }) => flags.all(ctx, context),
});
```

…then point the provider at it. The provider subscribes reactively, so a rule
change in the dashboard updates the UI without a refresh.

```tsx
// app root
import { FlagsProvider } from "@vllnt/convex-flags/react";
import { api } from "../convex/_generated/api";

<FlagsProvider query={api.flags.evaluateAll} context={{ userId, attributes: { plan } }}>
  <App />
</FlagsProvider>;
```

```tsx
// any component
import { useFlag, useVariant, useFlagValue } from "@vllnt/convex-flags/react";

function Checkout() {
  const enabled = useFlag("new-checkout");          // boolean
  const cta = useVariant("hero-cta");               // "a" | "b" | "control"
  const maxMb = useFlagValue("max-upload-mb", 25);  // typed, with fallback

  return enabled ? <NewCheckout cta={cta} maxMb={maxMb} /> : <LegacyCheckout />;
}
```

---

## API

### Evaluation context

```ts
type EvalContext = {
  userId?: string;
  attributes?: Record<string, string | number | boolean>;
};
```

### `Flags` (server)

| Method | Returns | Purpose |
|--------|---------|---------|
| `isEnabled(ctx, key, context?)` | `boolean` | Boolean flags |
| `variant(ctx, key, context?)` | `string \| null` | Multivariate flags |
| `get(ctx, key, context?)` | `FlagValue` | Typed value / JSON payload |
| `evaluate(ctx, key, context?)` | `EvaluationResult` | Full result + `reason` |
| `all(ctx, context?)` | `Record<string, EvaluationResult>` | Bootstrap the client |

`EvaluationResult = { value: FlagValue; variant: string \| null; reason: string }`

### `Flags` — management

| Method | Purpose |
|--------|---------|
| `define(ctx, definition)` | Create or update a flag |
| `setRules(ctx, key, env, rules)` | Replace an environment's targeting rules |
| `enable(ctx, key, env)` / `disable(ctx, key, env)` | Toggle per environment |
| `list(ctx)` | All flag definitions |
| `archive(ctx, key)` | Soft-delete (stops serving, keeps history) |
| `remove(ctx, key)` | Hard-delete a flag and its rules |

### React

| Hook | Returns |
|------|---------|
| `useFlag(key)` | `boolean` |
| `useVariant(key)` | `string \| null` |
| `useFlagValue(key, fallback)` | typed value |
| `useFlags()` | full `Record<string, EvaluationResult>` |

`FlagsProvider` props: `{ query, context, client? }` — `client` defaults to the
ambient `ConvexReactClient`.

---

## Testing

Backend logic is covered with `convex-test` (in-process, no running backend):

```ts
import { convexTest } from "convex-test";
import { test, expect } from "vitest";
import schema from "./schema";

test("pro users get new-checkout, free users do not", async () => {
  const t = convexTest(schema);
  await t.mutation(api.flags.seed, {});

  expect(await t.query(api.flags.evaluateAll, {
    context: { userId: "u1", attributes: { plan: "pro" } },
  })).toMatchObject({ "new-checkout": { value: true } });

  expect(await t.query(api.flags.evaluateAll, {
    context: { userId: "u2", attributes: { plan: "free" } },
  })).toMatchObject({ "new-checkout": { value: false } });
});
```

End-to-end flows use the `@vllnt/testing` 4-layer framework (UI → hook → backend →
database) against a real Convex backend — never a mock.

---

## Environments

The targeting environment (`development` / `staging` / `production`) is a logical
concept set per deployment via `CONVEX_FLAGS_ENV`. It is independent of where the
backend runs: the same code serves Convex Cloud and self-hosted `convex-backend`,
reading the client origin from `NEXT_PUBLIC_CONVEX_URL` only.

---

## License

MIT
