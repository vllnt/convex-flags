<!-- Badges -->
[![Convex Component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://www.convex.dev/components)
[![npm](https://img.shields.io/npm/v/@vllnt/convex-flags.svg)](https://www.npmjs.com/package/@vllnt/convex-flags)
[![CI](https://img.shields.io/github/actions/workflow/status/vllnt/convex-flags/ci.yml?branch=main&label=CI)](https://github.com/vllnt/convex-flags/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-flags.svg)](./LICENSE)

# @vllnt/convex-flags

Feature flags as a Convex component — backend-evaluated and streamed to every connected client in real time: boolean kill-switches, multivariate variants, percentage rollouts, attribute targeting, and per-subject overrides, with no redeploy and no third-party flag SaaS.

```ts
const flags = new Flags(components.flags);
await flags.define(ctx, { key: "new-checkout", value: false });
await flags.enable(ctx, "new-checkout");
const on = await flags.isEnabled(ctx, "new-checkout", { subjectRef: userId }); // reactive in a query
```

## Features

- **Boolean, multivariate & rollouts** — boolean kill-switches, string/number variants, and weighted percentage rollouts with stable per-subject bucketing.
- **Attribute targeting** — ordered rules (`eq`, `in`, `contains`, `gt`, …) over a host-supplied typed context.
- **Per-subject overrides** — force any flag's value for one subject.
- **Lifecycle** — archive (reversible) distinct from permanent delete.
- **Real-time** — evaluated in Convex queries, so changes stream to clients over the same reactive subscriptions as your app data.
- **Data isolation** — definitions and overrides live in the component's own sandboxed tables; no blast radius into your schema.
- **Reactive React hooks** — optional `./react` entry (`useFlag`/`useFlags`); backend-only consumers pull in zero React.
- **Auth-agnostic & dual-target** — the host gates every management call; runs unchanged on Convex Cloud and self-hosted `convex-backend`.

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

Peer dependency: `convex@^1.36.1`. `react` is an optional peer dependency, needed only for the `./react` entry.

## Usage

```ts
// convex/flags.ts — instantiate once, then re-export the public function refs the
// rest of your app (and the React hooks) call. The host owns auth: gate the
// management mutations here before delegating to the component.
import { v } from "convex/values";
import { Flags } from "@vllnt/convex-flags";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";

export const flags = new Flags(components.flags);

// Evaluation queries — reactive; `api.flags.evaluate` is what the React hooks below use.
export const evaluate = query({
  args: { key: v.string(), context: v.optional(v.any()), default: v.optional(v.any()) },
  handler: (ctx, args) =>
    flags.evaluate(ctx, args.key, { context: args.context, default: args.default }),
});

export const all = query({
  args: { context: v.optional(v.any()) },
  handler: (ctx, args) => flags.all(ctx, args.context),
});

// Management mutations — apply your own auth check before delegating.
export const define = mutation({
  args: { key: v.string(), value: v.any() /* + description/variants/rules/rollout */ },
  handler: (ctx, args) => {
    // assertAdmin(ctx);
    return flags.define(ctx, args);
  },
});

// Wrap the rest the same way — `update`, `enable`, `disable`, `archive`,
// `restore`, `setOverride`, `clearOverride` — each gated then delegated.
```

```ts
// Flags are data — create them from your own authorized mutations (host owns auth),
// then evaluate inside any query, mutation, or action.
import { query } from "./_generated/server";
import { flags } from "./flags";

// A targeted rollout: pro users get the new checkout; everyone else is a 50/50 split.
export const setup = async (ctx) => {
  await flags.define(ctx, {
    key: "new-checkout",
    value: false,
    rules: [{ conditions: [{ attribute: "plan", op: "eq", values: ["pro"] }], value: true }],
    rollout: { splits: [{ value: true, weight: 50 }, { value: false, weight: 50 }] },
  });
};

export const checkout = query({
  args: {},
  handler: async (ctx) =>
    (await flags.isEnabled(ctx, "new-checkout", { subjectRef: "user-123", attributes: { plan: "free" } }))
      ? loadNewCheckout(ctx)
      : loadLegacyCheckout(ctx),
});
```

## API Reference

| Method | Kind | Result |
|--------|------|--------|
| `isEnabled(ctx, key, context?)` | query | `boolean` (value `=== true`) |
| `evaluate(ctx, key, options?)` | query | `FlagEvaluation` (`value` + `reason`) |
| `variant(ctx, key, options?)` | query | the resolved value |
| `get(ctx, key)` / `list(ctx)` | query | `FlagDoc \| null` / `FlagDoc[]` |
| `all(ctx, context?)` | query | `Record<string, FlagEvaluation>` (reactive bootstrap) |
| `define(ctx, definition)` | mutation | Create or **fully replace** a flag (value, variants, rules, rollout) |
| `update(ctx, key, patch)` | mutation | **Partially** update a flag — only supplied fields change, the rest are kept |
| `enable(ctx, key)` / `disable(ctx, key)` | mutation | Toggle a boolean flag (sets value `true`/`false`) |
| `archive(ctx, key)` / `restore(ctx, key)` | mutation | Reversibly retire / re-activate a flag |
| `setOverride(ctx, key, subjectRef, value)` / `clearOverride(ctx, key, subjectRef)` | mutation | Force / clear a per-subject value |
| `remove(ctx, key)` | mutation | Hard-delete a flag and its overrides |

`evaluate` resolves in order: override → archived → targeting rules → fallthrough rollout → flag
value; an unknown key serves the caller `default` or `false`. `enable`/`disable` are boolean
convenience (they set the value to `true`/`false`) — use `define`/`update` for multivariate flags.
Full reference, types, operators, and the React hooks: [docs/API.md](docs/API.md).

## React

Optional reactive hooks via the `./react` entry (`react` is an optional peer dependency). Pass the
`evaluate` query you exported from `convex/flags.ts` above — `api.flags.evaluate`:

```tsx
import { useFlag } from "@vllnt/convex-flags/react";
import { api } from "../convex/_generated/api";

// api.flags.evaluate is the query exported in convex/flags.ts (Usage, above).
const checkout = useFlag(api.flags.evaluate, "new-checkout", { context: { subjectRef: userId } });
if (checkout?.value === true) { /* render the new checkout */ }
```

| Hook | Returns |
|------|---------|
| `useFlag(query, key, options?)` | `FlagEvaluation \| undefined` |
| `useFlags(query, context?)` | `Record<string, FlagEvaluation> \| undefined` |

## Security

- Auth-agnostic — all management mutations are internal; wrap them in your own authorized mutations and apply auth there.
- Flag keys are opaque host-chosen strings; the component never interprets or validates their structure.
- Tables are sandboxed — the component never reads host or sibling tables.

See [docs/API.md](docs/API.md).

## Testing

```bash
pnpm test           # single run
pnpm test:coverage  # enforced 100% on covered files
```

Tests run against the real component runtime via `convex-test` (`@edge-runtime/vm`), not mocks.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Author

Built by [bntvllnt](https://github.com/bntvllnt) · [bntvllnt.com](https://bntvllnt.com) · [X @bntvllnt](https://x.com/bntvllnt)

Part of the [@vllnt](https://github.com/vllnt) Convex component fleet — [vllnt.com](https://vllnt.com)

If this is useful, [sponsor the work](https://github.com/sponsors/bntvllnt).

## License

MIT
