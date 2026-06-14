<!-- Badges -->
[![Convex Component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://www.convex.dev/components)
[![npm](https://img.shields.io/npm/v/@vllnt/convex-flags.svg)](https://www.npmjs.com/package/@vllnt/convex-flags)
[![CI](https://img.shields.io/github/actions/workflow/status/vllnt/convex-flags/ci.yml?branch=main&label=CI)](https://github.com/vllnt/convex-flags/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-flags.svg)](./LICENSE)

# @vllnt/convex-flags

Feature flags as a Convex component — boolean kill-switches evaluated on the backend and streamed to every connected client in real time, no redeploy and no third-party flag SaaS.

```ts
const flags = new Flags(components.flags);
await flags.enable(ctx, "new-checkout");
const enabled = await flags.isEnabled(ctx, "new-checkout"); // reactive in a query
```

## Features

- **Boolean kill-switches** — backend-evaluated, reactive, streamed to clients.
- **Data isolation** — definitions live in the component's own sandboxed `flags` table; no blast radius into your schema.
- **Reuse** — mount into any Convex backend with one `app.use()`.
- **Real-time** — flag changes propagate through the same subscription mechanism as your app data.
- **Dual-target** — runs unchanged on Convex Cloud and self-hosted `convex-backend`.
- **Auth-agnostic** — domain- and auth-neutral; the host gates every management call.

> **Planned (post-0.1.0):** multivariate variants, percentage rollouts, attribute targeting, per-environment rules, and React hooks. Agents must not implement these without an explicit instruction.

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

Peer dependency: `convex@^1.41.0`.

## Usage

```ts
// convex/flags.ts — instantiate once and re-export.
import { Flags } from "@vllnt/convex-flags";
import { components } from "./_generated/api";

export const flags = new Flags(components.flags);
```

```ts
// Flags are data — create them from your own authorized mutations (host owns auth),
// then evaluate inside any query, mutation, or action.
import { query } from "./_generated/server";
import { flags } from "./flags";

export const setup = async (ctx) => {
  await flags.define(ctx, { key: "new-checkout", value: false, description: "Rebuilt checkout" });
  await flags.enable(ctx, "new-checkout");  // or flags.disable(ctx, key)
};

export const checkout = query({
  args: {},
  handler: async (ctx) =>
    (await flags.isEnabled(ctx, "new-checkout"))
      ? loadNewCheckout(ctx)
      : loadLegacyCheckout(ctx),
});
```

## API Reference

| Method | Kind | Result |
|--------|------|--------|
| `isEnabled(ctx, key)` | query | `boolean` (`false` for undefined keys) |
| `evaluate(ctx, key)` | query | `FlagEvaluation` (`value` + `reason`) |
| `get(ctx, key)` | query | `FlagDoc \| null` |
| `list(ctx)` | query | `FlagDoc[]` |
| `all(ctx)` | query | `Record<string, FlagEvaluation>` (reactive bootstrap) |
| `define(ctx, definition)` | mutation | Create or update a flag (host gates access) |
| `enable(ctx, key)` / `disable(ctx, key)` | mutation | Set the flag value |
| `remove(ctx, key)` | mutation | Hard-delete a flag |

Full reference: [docs/API.md](docs/API.md).

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
