# Implementation Wave 04, Approval To Definitive External Execution

## Target rules

- `RULE-024`
- `RULE-025`
- `RULE-026`
- `RULE-031`
- `RULE-036`
- `RULE-038`
- `RULE-039`

## Goal

Make approved pre-entries follow target-doc meaning:

- approval is human authorization to execute definitive external creation,
- payable approvals create supplier and payable in OMIE when needed,
- receivable approvals create definitive external receivable in chosen system path,
- local records are audit mirrors, not final stopping point.

## Canonical execution contract

This wave adopts one contract, no split behavior:

- `Approve` changes pre-entry to approved and enqueues mandatory execution job.
- Execution worker performs definitive external creation.
- Success marks item `completed`.
- Failure marks item `integration_error`.
- Operator does not need a second manual OMIE export click for normal flow.

Manual retry is allowed after failure. Manual first-time execute action is not canonical.

## Backend tasks

- Remove current product assumption that approval ends at local `AccountPayable` or `AccountReceivable`.
- Refactor approval flow in `api/src/lib/draft-workflow.ts`:
  - approval writes review audit,
  - approval validates required fields,
  - approval creates execution job record,
  - approval does not stop at local-only financial record.
- Introduce execution queue and worker path for approved pre-entries.
- Split execution by direction:
  - payable -> ensure supplier exists, then create definitive payable in OMIE
  - receivable -> create definitive receivable in chosen target path, default OMIE first unless later fiscal flow explicitly overrides
- Keep local `AccountPayable` and `AccountReceivable` only as mirrored internal records written after successful external creation, not before.
- Update OMIE service layer so payable creation can be called from queue worker, not only from explicit export route.
- Replace explicit user-facing OMIE export route as primary flow:
  - keep retry/replay admin route if needed,
  - remove it from normal operator happy path.
- Add idempotency guard:
  - one approved pre-entry cannot create duplicate external payable/receivable,
  - repeated retries must detect prior external success by stored external id or sync record.
- Persist execution lifecycle:
  - queued,
  - running,
  - success,
  - error,
  - retry count,
  - last error,
  - external ids,
  - provider payload snapshot,
  - response snapshot.
- For payable path, implement supplier resolution order:
  1. existing internal supplier by document,
  2. existing OMIE mapping by sync record,
  3. create supplier in OMIE,
  4. persist local sync mapping,
  5. create payable in OMIE.
- For receivable path, implement first external ownership path explicitly:
  - create receivable in OMIE,
  - persist billing artifact references,
  - if boleto generation is part of same provider flow, persist boleto link or document reference,
  - if invoice trigger is deferred, keep explicit pending invoice state instead of pretending it is complete.
- Expand sync and request logging so operator can inspect:
  - approval time,
  - queue time,
  - external creation attempt,
  - provider result,
  - retry history.

## Frontend tasks

- Change review queue UX so `Approve` means `approve and send to execution flow`.
- Remove normal-path dependence on `Criar no OMIE` button from `src/routes/validacao-financeira.tsx`.
- Replace with status display:
  - approved and queued,
  - sending,
  - completed,
  - integration error,
  - retry requested.
- Keep detailed provider history visible in review detail.
- Add retry action for failed executions, restricted to approved items with `integration_error`.
- Add explicit success surface:
  - external supplier created or matched,
  - external payable or receivable created,
  - external identifier,
  - boleto or invoice reference when available.
- Update labels so local records are not presented as definitive financial creation.

## Schema and data tasks

- Add execution queue table or equivalent execution fields linked to pre-entry.
- Add fields for:
  - execution status,
  - queued at,
  - started at,
  - finished at,
  - retry count,
  - last error,
  - external created id,
  - provider,
  - billing artifact references.
- Expand sync tables if needed to distinguish:
  - supplier sync,
  - payable sync,
  - receivable sync,
  - boleto generation,
  - fiscal trigger.
- Add configurable monthly cap fields only behind business-client and multi-CNPJ domain if that rule is approved in same milestone.

## Seed and demo impact

- Seed one approved payable queued for OMIE execution.
- Seed one successful payable execution with external ids.
- Seed one receivable execution success with billing artifact reference.
- Seed one execution failure with retryable error.
- Seed one duplicate-execution-protected case.

## Tests first

- Unit, approval creates queue item and does not directly mark external success.
- Unit, payable execution creates supplier then payable in correct order.
- Unit, retry path is idempotent after partial success.
- API, cannot approve item missing required payable or receivable fields.
- API, cannot create duplicate external execution for same approved pre-entry.
- API, failed provider call leaves `integration_error` with full audit trail.
- API, retry endpoint requeues only failed approved items.
- E2E, approve payable -> queued -> completed -> external history visible.
- E2E, failed execution -> retry -> completed.

## Exit criteria

- Approved item no longer stops at local-only record creation.
- Normal payable path results in definitive OMIE creation after approval.
- Normal receivable path results in definitive external receivable creation after approval.
- Queue, retry, and error states are visible and audited.
- Old manual export flow is no longer primary operator workflow.
