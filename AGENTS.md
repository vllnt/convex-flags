# convex-flags

> Feature flags as a Convex component: boolean & multivariate flags, % rollout, attribute targeting — evaluated server-side, streamed live to clients.

This is the canonical agent-instructions file for this repository. `AGENTS.md` is a byte-identical
mirror of this file for tools that read `AGENTS.md` — edit **this** file, then regenerate the mirror
with `cp CLAUDE.md AGENTS.md`.

## Project Overview

- **Status:** design stage — the public API is documented in `README.md`; implementation pending.
  Treat the README as the build spec.
- **Package:** `@vllnt/convex-flags` (publishable Convex component)
- **Tech stack:** TypeScript · Convex component (`@convex-dev` component model)
- **Package manager / tooling:** npm
- **Primary branch:** main
- **License:** MIT

## Common Commands

Intended toolchain (scripts land with the implementation; remove rows that do not apply).

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies / bootstrap |
| `npm run lint` | Lint / format checks |
| `npm run build` | Build / package (tsc) |
| `npm test` | Run tests (vitest + convex-test) |

## Rules

Modular rules live in `.claude/rules/`. Each is loaded on demand.

- @.claude/rules/git-workflow.md
- @.claude/rules/code-style.md
- @.claude/rules/security.md
- @.claude/rules/commit-privacy.md

When you add a rule file, add a matching `@.claude/rules/<name>.md` line above and re-run
`cp CLAUDE.md AGENTS.md`.

## Boundaries

**Always:** follow existing patterns; update tests when behavior changes; update docs on public
behavior change. Keep the public API in sync with `README.md`.

**Ask first:** new dependencies/services; public API or schema changes; CI/CD or release changes;
security-sensitive config.

**Never:** commit secrets; rewrite shared history without approval; disable quality gates without
documenting why.
