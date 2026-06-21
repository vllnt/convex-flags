<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `example/convex/_generated/ai/guidelines.md` first** for
important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

# @vllnt/convex-flags

`@vllnt/convex-flags` is a Convex component for feature flags — evaluated on the
backend and streamed to clients over Convex's reactive queries. It supports
boolean kill-switches, string/number variants, attribute-targeting rules,
weighted percentage rollouts, per-subject overrides, and reversible archiving.
It owns its own sandboxed `flags` and `overrides` tables and has no child
components. It follows the vllnt Component Standard (see the `convex-components`
hub `.claude/rules/component-standard.md`).

## Architecture

```
src/
├── shared.ts              # EVAL_REASON codes, public types, and the PURE evaluation engine
│                          #   (condition matching, FNV-1a bucketing, rule/rollout resolution)
├── test.ts                # convex-test registration helper (exported via "./test")
├── client/
│   ├── types.ts           # Public TS interfaces (FlagDoc, FlagDefinition, EvalOptions, re-exports)
│   └── index.ts           # Flags client class — the consumer-facing API
├── react/
│   └── index.ts           # Optional "./react" entry — useFlag / useFlags over convex/react useQuery
└── component/
    ├── mutations.ts        # define, update, enable, disable, archive, restore, remove, setOverride, clearOverride
    ├── queries.ts          # get, list, evaluate, all
    ├── validators.ts       # variantValue, condition, rule, rollout, flagFields, overrideFields, evalContext, …
    ├── schema.ts           # flags (by_key) + overrides (by_key_subject, by_subject) tables
    └── convex.config.ts    # defineComponent("flags")
```

## Ownership boundary

| Domain | Owner |
|--------|-------|
| `flags` + `overrides` tables | **Component** — sandboxed, never reached by host or siblings |
| Flag keys, subject refs, attribute names/values | **Host** — opaque to the component; chosen and interpreted by the host |
| Auth / access control | **Host** — gates every management mutation behind its own mutations |
| Evaluation logic (rules, rollouts, overrides, lifecycle) | **Component** — pure engine in `shared.ts` + query layer |
| Evaluation context (`subjectRef`, `attributes`) | **Host** — supplied per call; the component never derives identity |

## Key design decisions

- **Typed evaluation context.** `evaluate(key, { context })` takes a host-supplied, opaque
  `EvalContext` (`{ subjectRef?, attributes? }`) of typed primitives — never `v.any()`. Targeting,
  rollouts, and overrides all key off it; the host owns what the refs and attributes mean.
- **Typed variant values, not `v.any()`.** A flag value is `boolean | string | number`. The client
  returns this typed union and the host narrows it. A per-host output generic is intentionally NOT
  used: narrowing the component's union return would require an unsafe cast and would break the
  `components.flags` → client constructor assignment. JSON-object variants are a documented future
  last resort.
- **Pure evaluation engine in `shared.ts`.** Condition matching, FNV-1a bucketing, and rule/rollout
  resolution are pure (no `ctx`/db), reused by `evaluate`/`all` and exercised end-to-end at 100%.
  Per-subject overrides and unknown-key handling layer in the query (they need a DB read).
- **Archived = disabled.** An archived flag skips targeting and serves its base value with reason
  `disabled`; `restore` re-activates. Distinct from hard `remove`, which also deletes the flag's
  overrides.
- **Reactive evaluation is read-only.** `evaluate` is a query and cannot write, so there is
  deliberately no `lastEvaluatedAt` stamping / stale-flag detection (that would require a write on
  read). Change history / audit is left to compose `@vllnt/convex-events`, not an in-component table.
- **Auth-agnostic.** All management mutations are internal Convex functions; the host wraps them in
  its own authorized mutations. The component has zero knowledge of the auth model.
- **Mount-safe; no `scope` field.** Sandboxed tables, no cross-mount singletons, no crons — correct
  under multiple `app.use(flags, { name })` mounts. Per-environment values fall out of Convex's
  per-deployment isolation (dev/preview/prod are separate deployments); an environment can also ride
  in as a context attribute. The flag key already namespaces, so no `scope` dimension is added.
- **Code-tagged errors.** Missing flags throw `FLAG_NOT_FOUND` — never a bare string.
- **Deferred (not built).** Named reusable segments (inline rule conditions cover targeting),
  JSON-object variant values, scheduled/progressive rollouts, stale-flag detection, and audit-event
  emission — see `ROADMAP.md` › `Later`.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test            # vitest + convex-test (@edge-runtime/vm) + jsdom (react)
pnpm test:coverage   # 100% coverage gate (thresholds in vitest.config.mts)
```

Use `pnpm build:codegen` (or `npx convex dev --once`) to regenerate the checked-in Convex
`_generated` files after a schema/function change; this needs a configured Convex deployment.

## Key Conventions

- All Convex functions use explicit `args` validators and `returns` types.
- Mutations live in `mutations.ts`, queries in `queries.ts` (enforced by `@vllnt/eslint-config/convex`).
- Sandboxed `flags` + `overrides` tables only — the component never reads host or sibling tables.
- A flag is keyed by an opaque, host-chosen string. The host owns auth and gates the management
  methods (`define`, `update`, `enable`, `disable`, `archive`, `restore`, `remove`, `setOverride`,
  `clearOverride`).
- `define` fully replaces a definition; `update` patches only the supplied fields. `enable`/`disable`
  are boolean convenience (set the value to `true`/`false`) — multivariate flags use `define`/`update`.
- No bare `v.any()` in component code; the engine in `shared.ts` stays pure.
- Errors are code-tagged: missing flags throw `FLAG_NOT_FOUND`.

## Docs sync

| Changed | Update in same commit |
|---------|----------------------|
| Client method signature (`src/client/index.ts`) | `docs/API.md`, `README.md` API Reference, `llms.txt` |
| Engine / reason codes (`src/shared.ts`) | `docs/API.md` (evaluation order, types), `README.md` |
| Schema / table fields (`src/component/schema.ts`, `validators.ts`) | `docs/API.md` Types, `README.md` Features |
| `./react` hooks (`src/react/index.ts`) | `docs/API.md` React, `README.md` React |
| Error codes | `docs/API.md` Error codes table |
| Version bump | `CHANGELOG.md` entry, README badges (auto via CI) |
| License | `README.md` License section, `llms.txt` License link label |
| Convex peer range | `llms.txt` context line + `docs/API.md` Compatibility + `README.md` peer note |
