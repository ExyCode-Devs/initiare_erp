# Current System Map

## Core Runtime Shape

Current repo is not blank. It already behaves like a tenant-scoped financial review product with:

- JWT auth, per-company access control.
- legal-entity-aware routing on top of tenant/company scope.
- signed Active Actions ingress for normalized financial drafts.
- human review queue for drafts.
- manual OMIE export after approval.
- Asaas config, sync, webhook capture, and visibility.

Main runtime registration is in `api/src/app.ts`.

## Data Boundaries Already Present

Main tenant root:

- `Company`

Operational scoping already present:

- `User.companyId`
- `LegalEntity.companyId`
- `FinancialDraft.companyId`
- `ErpConnection.companyId`
- `AiEventSource.companyId`
- `AuditLog.companyId`

Legal-entity routing layer already present:

- `LegalEntity`
- `FinancialDraft.legalEntityId`
- `AiEventSource.legalEntityId`
- `ErpConnection.legalEntityId`

This means current repo is already beyond simple single-company MVP.

## Intake And Routing

Current intake path is Active Actions first, not Gmail inbox first.

Active runtime facts:

- `/api/ai/events/financial-drafts` is live in `api/src/routes/ai-events.ts`.
- Request must be HMAC-signed.
- Routing uses `targetCnpj`, recipient alias, and mailbox alias in `api/src/lib/legal-entities.ts`.
- Route result can be `ROUTED` or `UNROUTED`.
- If company cannot be resolved, endpoint returns `422`.

Disabled legacy paths:

- `/api/mailboxes` returns `410` in `api/src/routes/mailboxes.ts`.
- `/api/inbox/emails` returns `410` in `api/src/routes/inbox.ts`.

Meaning:

- backend intentionally moved away from live IMAP inbox runtime,
- but repo still carries historical inbox/mailbox concepts and screens.

## Draft Review And Approval

Review queue is real and central already:

- `GET /api/financial-drafts`
- `GET /api/financial-drafts/:id`
- `PATCH /api/financial-drafts/:id`
- `POST /api/financial-drafts/:id/approve`
- `POST /api/financial-drafts/:id/reject`
- `POST /api/financial-drafts/:id/omie-export`

Implementation anchors:

- `api/src/routes/financial-drafts.ts`
- `api/src/lib/draft-workflow.ts`
- `api/src/lib/omie-export-service.ts`
- `src/routes/validacao-financeira.tsx`

Current behavior:

- Draft can be edited.
- Review actions are audited.
- Approval creates local payable or receivable records.
- OMIE export only happens in separate explicit action.

## OMIE And Asaas

OMIE:

- per-legal-entity connection config,
- test connection,
- sync catalogs,
- export approved drafts,
- request and sync history.

Anchors:

- `api/src/routes/omie.ts`
- `api/src/lib/omie-connections.ts`
- `api/src/lib/omie-catalog-sync-service.ts`
- `api/src/lib/omie-export-service.ts`

Asaas:

- per-legal-entity connection config,
- test connection,
- webhook endpoint,
- sync service,
- payments and webhook visibility.

Anchors:

- `api/src/routes/asaas.ts`
- `api/src/lib/asaas-connections.ts`
- `api/src/lib/asaas-sync-service.ts`
- `api/src/lib/asaas-webhook-service.ts`

## Frontend State

Current navigation still shows broad financial product shape in `src/lib/navigation.ts`:

- Dashboard
- Operacoes
- Validacao Financeira
- Contas a Pagar
- Contas a Receber
- Conciliacao
- Excecoes
- Configuracoes

Important alignment note:

- `src/routes/validacao-financeira.tsx` is aligned with current backend.
- `src/routes/configuracoes.tsx` is aligned with legal-entity and OMIE/Asaas settings.
- `src/routes/inbox-financeiro.tsx` is stale relative to backend because it still expects live mailbox and inbox routes.

## Tests Already Present

Current test surface already covers part of target safety model:

- unit draft approval and rejection flow in `tests/unit/draft-workflow.test.ts`
- signed event ingress and legacy route `410` behavior in `tests/api/app-routes.test.ts`
- e2e draft review and finance screens in `tests/e2e/app.spec.ts`

This is useful because future rule work can expand from existing contracts instead of inventing new harnesses.

## Summary Of Current Direction

Current repo direction is:

1. tenant-safe backend first,
2. event-driven draft ingestion,
3. human review queue,
4. explicit external integration actions,
5. legal-entity-aware configuration,
6. partial analytics and exception views.

Current repo is not yet:

1. full Gmail/Workspace operational inbox product,
2. full business-client and alias domain model,
3. unified downstream execution flow after approval,
4. contracts/OS receivable engine,
5. final client portal or fiscal-note platform.
