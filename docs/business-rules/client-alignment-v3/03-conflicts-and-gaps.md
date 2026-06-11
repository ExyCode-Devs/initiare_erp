# Conflicts And Gaps

## Total Conflicts

### 1. Intake strategy, Gmail/IMAP vs Active Actions

Target doc direction:

- Gmail/Workspace operational inboxes,
- alias-aware routing from email headers,
- operational mailbox monitoring,
- inbox screen as core product surface.

Current repo direction:

- signed Active Actions pushes normalized drafts,
- `/api/mailboxes` and `/api/inbox/emails` intentionally return `410`,
- inbox frontend screen is stale.

Why this matters:

- affects backend contracts,
- affects data model,
- affects worker/job strategy,
- affects UI navigation and operator workflow.

Default action:

- treat Gmail/Workspace operational intake as target path and migrate current Active Actions-first runtime away from being primary product contract.

### 2. Approval outcome, local record vs definitive external execution

Target doc direction:

- after approval, system should create definitive payable/receivable in OMIE, Asaas, or other integrated system.

Current repo direction:

- approval creates local `AccountPayable` or `AccountReceivable`,
- OMIE export is separate manual action,
- Asaas sync is not tied to unified post-approval execution flow.

Why this matters:

- changes core state machine,
- changes audit semantics,
- changes operator expectations,
- changes tests across backend and frontend.

Default action:

- redesign approval flow toward target doc, approved item should proceed to definitive external creation path instead of stopping at local-only record.

### 3. Operational inbox UI contract drift

Target doc direction:

- inbox is a primary screen.

Current repo direction:

- frontend has inbox route,
- backend denies inbox APIs.

Why this matters:

- product appears half-migrated,
- easy bug source,
- confuses future implementers.

Default action:

- restore backend contract and real inbox behavior to match target doc, then remove any transitional dead-path UI or API remnants.

## Partial Conflicts

### 4. Role model

Target:

- platform super admin,
- tenant admin,
- tenant manager/operator,
- tenant client user.

Current:

- `ADMIN`,
- `ANALYST`,
- `VIEWER`.

Gap:

- missing platform-level and external-client roles.

### 5. Alias and sender modeling

Target:

- dedicated alias table,
- dedicated authorized sender table,
- business-client link,
- reply mailbox policy.

Current:

- alias-like arrays on `LegalEntity`,
- no dedicated sender authorization model.

Gap:

- current model works for basic routing hints, not full email-governance workflow.

### 6. Draft status model

Target:

- richer states for duplicate, sent, integration error, completed, answered.

Current:

- only pending review, approved, rejected at draft level,
- some integration state lives in separate sync tables.

Gap:

- current state model is too small for future workflow complexity.

### 7. Classification and master data depth

Target:

- tenant and business-client scoped categories,
- departments,
- centers of cost,
- richer supplier and payer structures.

Current:

- basic category strings on drafts and payables,
- no first-class department or payer model.

Gap:

- current repo can show and store basic approval info, but not full target accounting structure.

## Net-New Areas

These do not clearly conflict with current system, but are mostly absent:

- recurring contract billing,
- OMIE service-order receivable intake,
- formal duplicate-handling workflow,
- monthly invoice-cap rules by CNPJ,
- fiscal-note orchestration,
- client portal,
- client-level BI model,
- tenant-configured email reply templates,
- business-client to multi-CNPJ distribution rules.

## Recommended Order

Resolve in this order:

1. intake strategy,
2. approval-to-execution target contract,
3. stale inbox UI/backend mismatch,
4. target role and domain model boundaries,
5. richer modules like contracts, OS, portal, BI.

Implementation bias for this file:

- when target doc and repo disagree, build toward target doc,
- use current repo only as migration context and regression map.
