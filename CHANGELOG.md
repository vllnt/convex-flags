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
- Rollouts with a non-whole-number weight now split subjects by their weights. In 0.1.0 some of
  these weights bucketed unevenly: weights summing to 1 (such as `0.5` / `0.5`) sent every subject
  to the first split, other sets were skewed (`1.5` / `1.5` served about 67% / 33%), and a split
  could get no subjects at all (`0.25` / `0.75` / `1` never served its middle split). These
  rollouts are re-bucketed once on upgrade, so some of their subjects change value. Rollouts whose
  weights are all whole numbers, and rows stored with an `Infinity` weight before weights were
  validated, bucket exactly as before.

### Changed

- Management mutations (`define`, `update`, `enable`, `disable`, `archive`, `restore`,
  `setOverride`) skip the write when nothing changed, so idempotent re-defines no longer bump
  `updatedAt` or re-run every `evaluate`/`all` subscription.
- Upgrade dev tooling (vitest 5.1.1, vite 8.3, convex 1.51, convex-test 0.0.73, prettier 3.10,
  jsdom 31, `@vllnt/typescript` 3 with `exactOptionalPropertyTypes` kept off), and override the
  vulnerable transitive `handlebars`, `deepmerge-ts` and `minimatch` releases.
- Adopt pnpm 10 with a release-age gate; releases are published only from CI with npm trusted
  publishing and provenance.
- Document the component error codes and how to use `/test` in a consuming app.
- The package now ships `docs/API.md`, `CHANGELOG.md` and `llms.txt`, so the docs in
  `node_modules/@vllnt/convex-flags/` match the installed version. `llms.txt` links to these
  files with relative paths, and a `test:package` CI check fails when a required file is missing
  from the tarball or a contributor-only file is included.
- `docs/API.md` lists every entry point and its exports, the `./react` option and ref types, and
  how a rollout that cannot bucket inside a matched rule falls back to the flag value.
- Canary builds publish on every qualifying push to `main` (dist-tag `canary` only, never
  `latest`), including docs-only changes to the shipped files.
- `engines.node` is now `>=20`, matching what `convex` itself requires (no `convex` version in
  the peer range supports Node 18).
- README rewritten in a fixed, agent-first order (when to use, install, quick start, an API table
  linking every export and `Flags` method to `docs/API.md`, common tasks, every error code with its
  fix, limits and gotchas, compatibility), with one `docs/API.md` heading per export, a
  "When to use" section and the errors link in `llms.txt`, and a shorter `package.json`
  description and keywords; `pnpm test:package` now installs the packed tarball in a temporary app,
  checks this docs contract (`scripts/check-documentation.mjs`), type-checks the README examples
  against convex 1.45.0 and React 18 and runs the README test example.

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
