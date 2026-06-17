# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Multivariate variants** — a flag value is now a typed primitive (`boolean | string | number`);
  `define` accepts `variants` metadata. Added `variant(ctx, key, options?)` returning just the value.
- **Attribute targeting** — `define` accepts ordered `rules` (`{ conditions, value | rollout }`) with
  operators `eq`, `neq`, `in`, `nin`, `contains`, `gt`, `gte`, `lt`, `lte`. First matching rule wins;
  conditions within a rule AND together; an empty condition list is a catch-all.
- **Percentage rollouts** — `define` accepts a `rollout` of weighted `splits`, bucketed
  deterministically (FNV-1a) by `context.subjectRef` or a named `by` attribute, so a subject always
  resolves to the same value.
- **Evaluation context** — `evaluate` / `isEnabled` / `all` / `variant` take an optional host-supplied
  `EvalContext` (`{ subjectRef?, attributes? }`); `evaluate` takes an optional `default` for unknown keys.
- **Per-subject overrides** — `setOverride(key, subjectRef, value)` / `clearOverride(key, subjectRef)`;
  an override wins over targeting in `evaluate` and `all`.
- **Lifecycle** — `archive(key)` (reversible; serves the base value with reason `disabled`) and
  `restore(key)`, distinct from `remove` (which now also deletes a flag's overrides).
- **React** — optional `@vllnt/convex-flags/react` entry exporting `useFlag` / `useFlags`; `react` is
  an optional peer dependency.
- New evaluation reason codes: `rule`, `rollout`, `override`, `disabled`, `default` (alongside
  `flag`, `unknown`).

### Notes

- Backward compatible: the boolean kill-switch API (`define({ key, value })`, `enable`/`disable`,
  `isEnabled(key)`, `evaluate(key)`, `get`/`list`/`all`/`remove`) is unchanged.
- Deferred: named reusable segments, JSON-object variant values, scheduled/progressive rollouts,
  stale-flag detection, and audit-event emission — see `ROADMAP.md`.

## [0.1.0] - 2026-06-12

### Added

- First release of `@vllnt/convex-flags` — boolean feature flags as a sandboxed
  Convex component, evaluated on the backend and streamed to clients over Convex's
  reactive queries.
- `Flags` client class: `define`, `enable`, `disable`, `remove`, `get`, `list`,
  `evaluate`, `isEnabled`, and `all`.
- Sandboxed `flags` table keyed by an opaque, host-chosen flag key (`by_key` index).
- `example/convex/` host-app harness with 100% end-to-end coverage via `convex-test`
  (happy path plus `FLAG_NOT_FOUND` adversarial paths).

> Multivariate variants, percentage rollouts, attribute targeting, per-environment
> rules, and the React provider/hooks sketched in the README are planned for
> follow-up releases — see the README for the target surface.
