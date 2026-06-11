# Client Alignment v3 Audit Method

## Purpose

This folder converts `initiare_erp_regras_negocio_codex_v3.md` into:

- atomic business rules,
- current-system evidence,
- conflict classification,
- implementation waves,
- validation backlog.

This is audit-first. For conflict rows, target doc is implementation truth unless external capability, product ambiguity, or risk forces explicit validation first.

## Sources

Primary source doc:

- `C:\Users\samsung\Downloads\initiare_erp_regras_negocio_codex_v3.md`

Primary repo evidence:

- `api/prisma/schema.prisma`
- `api/src/app.ts`
- `api/src/routes/financial-drafts.ts`
- `api/src/lib/draft-workflow.ts`
- `api/src/routes/ai-events.ts`
- `api/src/routes/omie.ts`
- `api/src/routes/asaas.ts`
- `api/src/routes/inbox.ts`
- `api/src/routes/mailboxes.ts`
- `api/src/lib/legal-entities.ts`
- `src/routes/validacao-financeira.tsx`
- `src/routes/inbox-financeiro.tsx`
- `src/routes/configuracoes.tsx`
- `src/lib/navigation.ts`
- `tests/unit/draft-workflow.test.ts`
- `tests/api/app-routes.test.ts`
- `tests/e2e/app.spec.ts`
- `docs/mvp-architecture.md`

## Rule ID Format

- Stable format: `RULE-001`, `RULE-002`, `RULE-003`
- One row, one decision-worthy rule.
- One rule may map to multiple files, but only one core behavior.

## Status Model

- `MATCH`, repo already follows rule.
- `PARTIAL_MATCH`, same direction, missing depth, missing boundaries, or incomplete coverage.
- `CONFLICT_PARTIAL`, repo has related behavior but target rule materially changes it.
- `CONFLICT_TOTAL`, repo points opposite direction.
- `NET_NEW`, no meaningful comparable behavior found.
- `NEEDS_VALIDATION`, doc statement is ambiguous, risky, product-level, or may be hallucinated.

## Evidence Rules

- Prefer code over older docs.
- Prefer tests when they confirm runtime intent.
- Treat `docs/mvp-architecture.md` as historical context only, not current truth.
- When backend and frontend disagree, backend route behavior is current contract, frontend mismatch is a gap.
- When no comparable symbol or route exists, mark `NET_NEW` or `NEEDS_VALIDATION`, not guessed conflict.

## Blocking Rules

Only these statuses block implementation by default:

- `CONFLICT_PARTIAL`
- `CONFLICT_TOTAL`
- `NEEDS_VALIDATION`

`NET_NEW` is not blocking by itself. It becomes implementation scope after business approval.

## How To Read Files

- `01-rule-matrix.md`, full atomic inventory.
- `02-current-system-map.md`, grouped snapshot of current repo behavior.
- `03-conflicts-and-gaps.md`, only important deltas.
- `implementation-wave-*.md`, testable implementation sequence after validation.
- `validation-backlog.md`, direct questions and assumptions to resolve.

## Default Decision Policy

- New meeting doc is target truth.
- Repo is current executable truth and migration starting point.
- `CONFLICT_PARTIAL` and `CONFLICT_TOTAL` mean repo should move toward target doc, not preserve current behavior by default.
- Only `NEEDS_VALIDATION` or explicit external unknowns should pause direct target-doc implementation.
- First implementation work should fix contract drift and operational safety before large new modules.
