# API Reference — @vllnt/convex-flags

The public surface is the `Flags` client class (`src/client/index.ts`). Construct it once
with the mounted component reference, then call its methods from host
queries/mutations/actions. The host owns auth — gate the management methods (`define`,
`enable`, `disable`, `remove`) behind your own authorized mutations.

```ts
import { Flags } from "@vllnt/convex-flags";
import { components } from "./_generated/api";

const flags = new Flags(components.flags);
```

## Methods

| Method | Args | Returns | Notes |
|--------|------|---------|-------|
| `define(ctx, definition)` | `{ key, value, description? }` | `Promise<string>` | Create a flag, or update its `value`/`description` if the key exists. Returns the flag id. |
| `enable(ctx, key)` | `string` | `Promise<null>` | Set the flag's value to `true`. Throws `FLAG_NOT_FOUND` if undefined. |
| `disable(ctx, key)` | `string` | `Promise<null>` | Set the flag's value to `false`. Throws `FLAG_NOT_FOUND` if undefined. |
| `remove(ctx, key)` | `string` | `Promise<null>` | Permanently delete a flag. Throws `FLAG_NOT_FOUND` if undefined. |
| `get(ctx, key)` | `string` | `Promise<FlagDoc \| null>` | Fetch a single flag definition, or `null`. |
| `list(ctx)` | — | `Promise<FlagDoc[]>` | Every flag definition. |
| `evaluate(ctx, key)` | `string` | `Promise<FlagEvaluation>` | `{ value, reason }`. `reason` is `"flag"` when defined, `"unknown"` when not. |
| `isEnabled(ctx, key)` | `string` | `Promise<boolean>` | The boolean value only; `false` for an undefined key. |
| `all(ctx)` | — | `Promise<Record<string, FlagEvaluation>>` | Evaluate every flag — the bootstrap payload for a reactive client subscription. |

### Types

```ts
interface FlagDoc {
  _id: string;
  _creationTime: number;
  key: string;
  description?: string;
  value: boolean;
  createdAt: number;
  updatedAt: number;
}

interface FlagEvaluation {
  value: boolean;
  reason: "flag" | "unknown";
}
```

## Roadmap

`0.1.0` ships the boolean kill-switch core. Multivariate variants, percentage rollouts,
attribute targeting, per-environment rules, and the React provider/hooks shown in the
README are planned for follow-up releases.
