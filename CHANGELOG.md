# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.1.1] - Unreleased

### Fixed

- The published tarball no longer includes the React and status test files.
- Management mutations reject an empty flag `key`, and `setOverride` / `clearOverride` an empty
  `subjectRef`, with `ConvexError({ code: "INVALID_ARGUMENT" })`.
- `define` and `update` reject rollout weights (flag-level and rule-level) that are `NaN`,
  infinite or negative with `INVALID_ARGUMENT`; previously they were silently ignored or skewed
  bucketing.
- `@vllnt/convex-flags/test` now type-checks under `moduleResolution: nodenext` (explicit `.js`
  relative imports, Vite client types referenced).

### Changed

- Upgrade dev tooling (vitest 5, vite 8.3, convex 1.48, convex-test 0.0.65, prettier 3.9.10) and
  drop transitive-dependency overrides the lockfile no longer needs.
- Adopt pnpm 10 with a release-age gate; releases are published only from CI with npm trusted
  publishing and provenance.
- Document the component error codes and how to use `/test` in a consuming app.

## [0.1.0] - 2026-09-01

### Added

- First release of `@vllnt/convex-flags` — feature flags as a sandboxed Convex component, evaluated
  on the backend and streamed to clients over Convex's reactive queries.
- `Flags` client class: `define`, `enable`, `disable`, `remove`, `get`, `list`, `evaluate`,
  `isEnabled`, and `all`.
- Sandboxed `flags` table keyed by an opaque, host-chosen flag key (`by_key` index).
- `example/convex/` host-app harness with 100% end-to-end coverage via `convex-test`.

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
- **Partial update** — `update(ctx, key, patch)` patches only the supplied fields, leaving the rest
  untouched (the opposite of `define`, which fully replaces a definition).

### Changed

- Treat Convex `_generated` output as CLI-owned, exclude it from formatting, and expose a
  dedicated codegen script.
- Refresh all direct dependencies to their latest compatible releases for canary validation.
- Require `convex@^1.45.0` and update `convex-test` to `^0.0.56`.
- **Docs polish** — refreshed the package tagline; the README Usage section now shows a complete
  `convex/flags.ts` host module (the `evaluate`/`all` queries the React hooks consume, plus gated
  management wrappers); documented `define` (full replace) vs `update` (partial) and that
  `enable`/`disable` are boolean convenience.

### Fixed

- **Backward-compatible `status`** — the stored `flags.status` column is now optional, so a
  deployment holding flag rows written before `status` existed no longer fails schema validation on
  the next `convex deploy` (`Object is missing the required field status`). Reads materialize an
  absent status as `"active"` — `get`/`list` return a concrete `status` and evaluation treats a
  legacy flag as active — so the public `FlagDoc` shape is unchanged. `define` still writes
  `status: "active"` for new flags; `restore(key)` stamps it onto legacy rows in storage.
  ([#5](https://github.com/vllnt/convex-flags/issues/5))

### Notes

- Backward compatible: the boolean kill-switch API (`define({ key, value })`, `enable`/`disable`,
  `isEnabled(key)`, `evaluate(key)`, `get`/`list`/`all`/`remove`) is unchanged.
- Deferred: named reusable segments, JSON-object variant values, scheduled/progressive rollouts,
  stale-flag detection, and audit-event emission — see `ROADMAP.md`.
