# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

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
