# Implementation Wave 03, Pre-Entry Workflow And Review State Machine

## Target rules

- `RULE-007`
- `RULE-008`
- `RULE-009`
- `RULE-020`
- `RULE-021`
- `RULE-022`
- `RULE-023`
- `RULE-027`
- `RULE-028`
- `RULE-029`
- `RULE-030`

## Goal

Make pre-entry review queue the single operational center between Gmail intake and definitive external execution:

- every financial item becomes a pre-entry first,
- every pre-entry follows one explicit state machine,
- every approval is guarded,
- duplicate and incomplete items are handled inside workflow,
- payable and receivable share same review contract before Wave 04 execution queue runs.

## Canonical workflow contract

This wave defines one review model, no split behavior:

1. Inbox or integration creates pre-entry.
2. Pre-entry receives normalized origin and review status.
3. Operator edits, enriches, or rejects.
4. Operator can mark duplicate or request reprocess.
5. Operator approves only when required fields and routing are safe.
6. Approved item becomes execution-ready for Wave 04 queue.

No pre-entry bypasses this review contract in MVP.

## Backend tasks

- Replace simple current draft model semantics with explicit pre-entry state machine:
  - `draft_ai`
  - `draft_integration`
  - `pending_review`
  - `edited`
  - `approved`
  - `rejected`
  - `duplicated`
  - `sent_to_integration`
  - `integration_error`
  - `completed`
  - `answered`, when outbound response exists
- Normalize all sources into first-class origin values:
  - email
  - email_attachment
  - omie
  - asaas
  - bank
  - manual
  - recurring_job
  - external_system
- Replace fragmented source assumptions in current `FinancialDraft` handling with one pre-entry service layer.
- Add approval guards by direction:
  - payable requires business client, supplier or payable party, amount, due date, description, category or classification placeholder, and source evidence
  - receivable requires business client, payer or receivable party, amount, due date, description, and external target path readiness
- Add route-safety guards:
  - unresolved business client -> cannot approve
  - unauthorized sender case -> cannot approve until manually resolved
  - ambiguous route case -> cannot approve until manually resolved
- Add duplicate-detection engine for payable and receivable:
  - candidate matching by tenant,
  - business client,
  - document number,
  - sender,
  - amount,
  - due date,
  - supplier or payer,
  - source reference and attachment hash when available
- Support explicit review actions:
  - edit fields
  - approve
  - reject
  - mark duplicate
  - undo duplicate
  - request AI reprocess
  - attach operator note
  - manually assign business client
  - manually assign supplier or payer
- Persist review audit log for every transition and field mutation.
- Add structured blocker fields so backend can explain why approval is denied:
  - missing required fields
  - route ambiguity
  - unauthorized sender
  - duplicate suspicion
  - invalid provider target readiness
- Keep Wave 04 execution state separate, but ensure approved state becomes execution-ready without new review semantics later.

## Frontend tasks

- Treat `src/routes/validacao-financeira.tsx` as canonical pre-entry center and redesign around state machine, not simple draft list.
- Show explicit source origin, route result, and business client context in queue rows.
- Show approval blockers inline before operator clicks approve.
- Add duplicate review UX:
  - flag candidate duplicates,
  - compare likely matches,
  - mark duplicate,
  - keep audit note for reason.
- Add reprocess UX for low-confidence or malformed AI extraction.
- Add manual enrichment fields required by target doc:
  - business client
  - supplier or payer
  - amount
  - due date
  - description
  - category
  - department or cost center when supported
  - notes
- Display normalized statuses, not current reduced draft-only labels.
- Keep provider history and downstream visibility read-only here until Wave 04 performs execution.
- Replace any label that implies approval already means definitive financial creation.

## Schema and data tasks

- Evolve current `FinancialDraft` into target-aligned pre-entry model or introduce replacement `financial_pre_entries` table with migration path.
- Add fields required for workflow:
  - `entry_type`
  - `origin`
  - `origin_reference_id`
  - `business_client_id`
  - `supplier_id`
  - `payer_id`
  - `status`
  - `ai_confidence`
  - `ai_explanation`
  - `approved_by`
  - `approved_at`
  - `duplicate_of_id`
  - `review_blockers_json`
  - `department_id`
  - `category_id`
  - `assigned_user_id`
- Add attachment linkage and audit tables if current review or evidence tables are insufficient.
- Keep migration compatibility from current `FinancialDraft`, `FinancialDraftReview`, and source event records until full cutover completes.

## Seed and demo impact

- Seed one valid payable pre-entry pending review.
- Seed one valid receivable pre-entry pending review.
- Seed one unauthorized sender case.
- Seed one ambiguous-route case.
- Seed one duplicate payable candidate.
- Seed one duplicate receivable candidate.
- Seed one missing-required-fields case.
- Seed one low-confidence case requiring AI reprocess.

## Tests first

- Unit, state transition rules.
- Unit, approval guard matrix by payable and receivable.
- Unit, duplicate detection matching logic.
- Unit, blocker generation for unauthorized sender and ambiguous route.
- API, cannot approve unresolved or incomplete pre-entry.
- API, duplicate mark and undo duplicate flows.
- API, reprocess request audit trail.
- API, tenant isolation on review actions and duplicate comparisons.
- E2E, inbox-created item appears in review queue with correct source metadata.
- E2E, operator edits then approves valid item.
- E2E, duplicate candidate is marked duplicate and removed from normal approval flow.
- E2E, unauthorized sender case remains blocked until manual correction.

## Exit criteria

- Review queue is explicit pre-entry workflow, not legacy draft CRUD.
- All inbound financial items share one review state machine.
- Approval is blocked by real backend rules, not operator memory.
- Duplicate handling is first-class.
- Approved items are cleanly ready for Wave 04 external execution queue.
