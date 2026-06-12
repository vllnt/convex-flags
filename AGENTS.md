<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `example/convex/_generated/ai/guidelines.md` first** for
important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

## Project Overview

`@vllnt/convex-flags` is a Convex component for boolean feature flags — kill-switches evaluated on
the backend and streamed to clients over Convex's reactive queries. It owns its own sandboxed
`flags` table and has no child components. It follows the vllnt Component Standard (see the
`convex-components` hub `.claude/rules/component-standard.md`).

## Architecture

```
src/
├── shared.ts              # EVAL_REASON codes + FlagEvaluation type (shared client + component)
├── test.ts                # convex-test registration helper (exported via "./test")
├── client/
│   ├── types.ts           # Public TypeScript interfaces (FlagDoc, FlagDefinition)
│   └── index.ts           # Flags client class — the consumer-facing API
└── component/
    ├── mutations.ts        # define, enable, disable, remove
    ├── queries.ts          # get, list, evaluate, all
    ├── validators.ts       # flagFields, flagDoc, evaluation
    ├── schema.ts           # flags table (by_key index)
    └── convex.config.ts    # defineComponent("flags")
```

## Scope (0.1.0)

Boolean kill-switches only. Multivariate variants, percentage rollouts, attribute targeting,
per-environment rules, and the React provider/hooks described in `README.md` are the planned
surface — not yet implemented. The README is the build spec for that roadmap.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test            # vitest + convex-test + @edge-runtime/vm
pnpm test:coverage   # 100% coverage gate (thresholds in vitest.config.mts)
```

Use `pnpm build:codegen` only when regenerating the checked-in Convex `_generated` files and you
have access to the selected Convex project.

## Key Conventions

- All Convex functions use explicit `args` validators and `returns` types.
- Mutations live in `mutations.ts`, queries in `queries.ts` (enforced by
  `@vllnt/eslint-config/convex`).
- Sandboxed `flags` table only — the component never reads host or sibling tables.
- A flag is keyed by an opaque, host-chosen string. The host owns auth and gates the management
  methods (`define`, `enable`, `disable`, `remove`).
- No bare `v.any()` in component code.
- Errors are code-tagged: missing flags throw `FLAG_NOT_FOUND`.
