# Roadmap — convex-flags

> Feature flags as a Convex component: backend-evaluated, reactive, and streamed to every
> connected client with no redeploy and no third-party flag SaaS.

**Now:** _between phases — the v0.2 targeting engine shipped; deferred follow-ups are in Later_
**Last updated:** 2026-06-17

## boolean-core [DONE 2026-06]

**Goal:** Ship a reactive boolean kill-switch component on the vllnt Component Standard.
**Exit criteria:** `@vllnt/convex-flags` 0.1.0 tagged, 100% E2E coverage green, mountable via `app.use`.

- [x] boolean-core.1 Implement flags table + define/enable/disable/remove mutations (#1)
- [x] boolean-core.2 Implement get/list/evaluate/isEnabled/all queries (#1)
- [x] boolean-core.3 Code-tagged FLAG_NOT_FOUND errors + typed validators (no v.any())
- [x] boolean-core.4 100% E2E coverage via example/ host harness
- [x] boolean-core.5 Standardize docs + identity block; mark unshipped API [planned]

## eval-context [DONE 2026-06]

**Goal:** Subject-aware evaluation — `evaluate` accepts a typed, host-supplied context, the
prerequisite that unlocked every targeting feature below.
**Exit criteria:** `evaluate(ctx, key, options)` resolves against a host-supplied typed context with
a deterministic bucketing helper, zero `v.any()`. — met.

- [x] eval-context.1 Design the typed eval-context seam (opaque subjectRef + typed attributes)
- [x] eval-context.2 Add per-flag fallback via a caller `default` (fixes the "off vs undefined" conflation)
- [x] eval-context.3 Add deterministic bucketing primitive (FNV-1a hash of subjectRef → split)
- [x] eval-context.4 Thread context through evaluate/isEnabled/all/variant; no-context path unchanged
- [x] eval-context.5 Document the multi-mount + per-deployment-environment pattern (AGENTS.md)

## variants [DONE 2026-06]

**Goal:** Multivariate flags — a flag resolves to a typed host value, not just boolean.
**Exit criteria:** A string/number-valued flag evaluates to its variant; value type is the typed
`boolean | string | number` union (never v.any()). — met.

- [x] variants.1 Generalize the flag value to the typed `VariantValue` union
- [x] variants.2 Variant options + labels metadata on `define`
- [x] variants.3 Backward-compat: a boolean flag is the two-variant case
- [-] variants.4 JSON-object variant values — deferred: documented last resort, no consumer yet, 2026-06-17 (Later)

## rollouts [DONE 2026-06]

**Goal:** Percentage rollouts with consistent per-subject bucketing.
**Exit criteria:** A flag at N% serves the same subject the same variant across evaluations. — met.

- [x] rollouts.1 Percentage-rollout outcome over the bucketing primitive (subjectRef or `by` attribute)
- [x] rollouts.2 Weighted splits across variants; unbucketable rollout falls through to the flag value

## targeting [DONE 2026-06]

**Goal:** Typed targeting rules + per-environment values.
**Exit criteria:** A flag serves a variant by ordered typed rules (attribute/op/value) against the
context, with a fallthrough. — met.

- [x] targeting.1 Typed rule shape (conditions attr/op/values; AND within a rule; first match wins; no v.any())
- [x] targeting.1b Operators: eq, neq, in, nin, contains, gt, gte, lt, lte
- [x] targeting.3 Per-environment resolved as a context attribute + Convex's per-deployment isolation (no `scope` field)
- [-] targeting.2 Named reusable segments — deferred: inline rule conditions cover targeting; revisit on a real consumer, 2026-06-17 (Later)

## react-tooling [DONE 2026-06]

**Goal:** Optional, tree-shakeable `./react` entry with reactive hooks.
**Exit criteria:** `useFlag`/`useFlags` render-tested in-component at 100%; backend-only consumers
pull zero React. — met.

- [x] react-tooling.1 Add ./react entry with useFlag/useFlags over re-exported function refs
- [x] react-tooling.2 jsdom + renderHook tests, coverage-included at 100%; react an optional peer dep

## flag-lifecycle [DONE 2026-06]

**Goal:** Operational lifecycle — archive and per-subject overrides.
**Exit criteria:** A flag can be archived (reversible) distinct from hard-delete; a subject's value
can be forced and cleared. — met.

- [x] flag-lifecycle.1 status active/archived + reversible archive/restore vs hard remove (which clears overrides)
- [x] flag-lifecycle.3 Per-subject override (setOverride/clearOverride; override wins in evaluate + all)
- [-] flag-lifecycle.2 lastEvaluatedAt stale detection — dropped: a reactive read-only query can't write on eval, 2026-06-17 (architectural)
- [-] flag-lifecycle.4 Change-history/audit — deferred: compose `@vllnt/convex-events` rather than own a table, 2026-06-17 (Later)

## Later

- Named reusable segments (targeting.2) — once a real consumer needs shared targeting groups.
- JSON-object variant values (variants.4) — the documented last resort, when a consumer needs it.
- Audit / change history (flag-lifecycle.4) — emit change events to compose `@vllnt/convex-events`.
- Scheduled / progressive rollout over time — defer until a 2nd consumer needs it.
- Maintainers / change-message metadata on edits.
- Stale-flag detection — needs a host-opt-in reporting path (reactive eval is read-only); revisit if a consumer asks.
- Not pursued (architecture / mandate): precompute & permutations, request-scoped dedupe, streaming/polling fallback chain (Convex reactivity obviates them), FLAGS_SECRET / DOM-value encryption / discovery-endpoint auth, SDK keys, third-party provider adapters & OpenFeature (dependency policy: official `@convex-dev/*` + `@vllnt/*` only), hosted dashboard & analytics (compose convex-analytics / convex-events, never absorb).
