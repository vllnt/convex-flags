# Roadmap — convex-flags

> Feature flags as a Convex component: backend-evaluated, reactive, and streamed to every
> connected client with no redeploy and no third-party flag SaaS.

**Now:** eval-context
**Last updated:** 2026-06-17

## boolean-core [DONE 2026-06]

**Goal:** Ship a reactive boolean kill-switch component on the vllnt Component Standard.
**Exit criteria:** `@vllnt/convex-flags` 0.1.0 tagged, 100% E2E coverage green, mountable via `app.use`.

- [x] boolean-core.1 Implement flags table + define/enable/disable/remove mutations (#1)
- [x] boolean-core.2 Implement get/list/evaluate/isEnabled/all queries (#1)
- [x] boolean-core.3 Code-tagged FLAG_NOT_FOUND errors + typed validators (no v.any())
- [x] boolean-core.4 100% E2E coverage via example/ host harness
- [x] boolean-core.5 Standardize docs + identity block; mark unshipped API [planned]

## eval-context [ACTIVE]

**Goal:** Subject-aware evaluation — `evaluate` accepts a typed, host-supplied context, the
prerequisite that unlocks every targeting feature below.
**Exit criteria:** `evaluate(ctx, key, context)` resolves a flag against a host-supplied typed
context with a deterministic bucketing helper, zero `v.any()`.

- [ ] eval-context.1 Spec the typed eval-context seam (host generic vs host-supplied validator; opaque subjectRef) — design doc, gates the rest
- [ ] eval-context.2 Add per-flag `defaultValue` to schema + evaluate fallback (fix the "off vs undefined" conflation)
- [ ] eval-context.3 Add deterministic bucketing primitive (stable hash of subjectRef → 0–99)
- [ ] eval-context.4 Thread context through evaluate/isEnabled/all; keep the no-context path backward-compatible
- [ ] eval-context.5 Document the multi-mount pattern (close the BLOCKING mount-safety doc gap)

## variants [PLANNED]

**Goal:** Multivariate flags — a flag resolves to a host-typed value, not just boolean.
**Exit criteria:** A string/number/JSON-valued flag evaluates to the host's typed variant, the
value type a host generic (never v.any()).

- [ ] variants.1 Generalize the flag value to a host-generic typed variant
- [ ] variants.2 Variant options + labels metadata
- [ ] variants.3 Backward-compat: a boolean flag is the two-variant case

## rollouts [PLANNED]

**Goal:** Percentage rollouts with consistent per-subject bucketing.
**Exit criteria:** A flag at N% serves the same subject the same variant across evaluations; the
distribution converges on ≈N%.

- [ ] rollouts.1 Percentage-rollout outcome over the bucketing primitive
- [ ] rollouts.2 Weighted splits across variants with a fallback variant

## targeting [PLANNED]

**Goal:** Typed targeting rules + reusable segments + per-environment values.
**Exit criteria:** A flag serves a variant by ordered typed rules (attribute/operator/value)
against the context with a fallthrough; per-environment values resolve correctly.

- [ ] targeting.1 Typed rule shape (attribute/operator/value, ordered, with fallthrough) — no v.any()
- [ ] targeting.2 Reusable named segments referenced by rules
- [ ] targeting.3 Decide per-environment = scope dimension vs context attribute, then implement

## react-tooling [PLANNED]

**Goal:** Optional, tree-shakeable `./react` entry with reactive hooks.
**Exit criteria:** `useFlag`/`useFlags` render-tested in-component at 100%; a backend-only consumer
pulls zero React.

- [ ] react-tooling.1 Add ./react entry with useFlag/useFlags over re-exported function refs
- [ ] react-tooling.2 jsdom + renderHook tests, coverage-included at 100%

## flag-lifecycle [PLANNED]

**Goal:** Operational lifecycle — archive, stale detection, per-subject overrides, change history.
**Exit criteria:** A flag can be archived (reversible) distinct from hard-delete, stale flags are
detectable, and an edit emits an auditable change event.

- [ ] flag-lifecycle.1 Add status (active/archived) + reversible archive vs hard remove
- [ ] flag-lifecycle.2 Track lastEvaluatedAt for stale / unreferenced detection
- [ ] flag-lifecycle.3 Per-subject override (force key=value for a subjectRef)
- [ ] flag-lifecycle.4 Emit change events for audit history via convex-events (compose — do not own a history table)

## Later

- Scheduled / progressive rollout over time (defer until a 2nd consumer needs it)
- Maintainers / change-message metadata on edits
- Not pursued (architecture / mandate): precompute & permutations, request-scoped dedupe, streaming/polling fallback chain (Convex reactivity obviates them), FLAGS_SECRET / DOM-value encryption / discovery-endpoint auth, SDK keys, third-party provider adapters & OpenFeature (dependency policy: official `@convex-dev/*` + `@vllnt/*` only), hosted dashboard & analytics (compose convex-analytics / convex-events, never absorb)
