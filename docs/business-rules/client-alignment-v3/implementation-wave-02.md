# Implementation Wave 02, Gmail Intake And Routing

## Target rules

- `RULE-010`
- `RULE-011`
- `RULE-012`
- `RULE-013`
- `RULE-014`
- `RULE-015`
- `RULE-016`
- `RULE-017`
- `RULE-018`
- `RULE-019`

## Goal

Replace current Active Actions-first product contract with target-doc intake:

- Gmail/Google Workspace operational inboxes are primary source.
- Client aliases and authorized senders drive routing.
- Inbox screen becomes first-class operational surface again.
- Active Actions, if preserved at all, becomes migration adapter, not primary product contract.

## Backend tasks

- Re-enable supported mailbox and inbox API surface under `/api/mailboxes` and `/api/inbox/emails`.
- Replace current `410` legacy handlers in:
  - `api/src/routes/mailboxes.ts`
  - `api/src/routes/inbox.ts`
- Implement OAuth-ready mailbox model as target contract, but allow first delivery with stored connection reference if OAuth wiring is phased behind feature flag.
- Create dedicated routing tables and stop using `LegalEntity.defaultRecipientEmails` and `defaultMailboxIds` as final model:
  - `operational_mailboxes`
  - `client_email_aliases`
  - `client_authorized_senders`
  - `business_clients`, if not already introduced in prior foundation wave
- Keep legacy `LegalEntity` alias fields read-only during migration for backfill only.
- Implement inbound message persistence with target metadata:
  - original alias,
  - mailbox received,
  - message/thread ids,
  - from/to/cc/bcc,
  - headers,
  - attachments,
  - detected business client,
  - assigned operator,
  - processing status.
- Implement client identification priority exactly as target doc:
  1. original alias from headers,
  2. `to` or equivalent original-recipient headers,
  3. authorized sender,
  4. dedicated operational mailbox,
  5. message content,
  6. manual operator association.
- Implement hard review routing:
  - unknown client -> `needs_review`
  - unauthorized sender -> `unauthorized_sender`
  - ambiguous alias/sender match -> `needs_review`
  - no automatic definitive execution from inbox stage
- Implement batch processing jobs per tenant, default schedules from target doc:
  - around 12:00
  - around 18:00
- Store job metrics per tenant and business client:
  - emails read,
  - interpreted,
  - pending,
  - pre-entries created,
  - approved,
  - processing time,
  - IA cost,
  - success rate.
- Preserve Active Actions endpoint only as transitional adapter if needed:
  - map payload into same inbound-message plus pre-entry pipeline,
  - remove any separate status or routing semantics,
  - do not expose it as canonical intake path in UI or docs.

## Frontend tasks

- Restore inbox product path as supported feature, not placeholder.
- Update `src/routes/inbox-financeiro.tsx` to consume real mailbox and inbox contracts instead of dead endpoints or mock-only assumptions.
- Show in inbox list:
  - business client,
  - subject,
  - sender,
  - received time,
  - detected request type,
  - attachment count,
  - confidence,
  - responsible operator,
  - linked pre-entry,
  - status.
- Show in inbox detail:
  - original alias,
  - operational mailbox,
  - sender authorization result,
  - routing reason,
  - attachments,
  - parsed summary,
  - linked review queue item.
- Add explicit badges and filter support for:
  - `received`
  - `queued`
  - `processing`
  - `needs_review`
  - `unauthorized_sender`
  - `pre_entry_created`
  - `approved`
  - `executed`
  - `answered`
  - `ignored`
  - `failed`
  - `duplicate`
- Remove language that implies Active Actions is main source of truth.

## Schema and data tasks

- Add tables aligned to target doc:
  - `business_clients`
  - `operational_mailboxes`
  - `client_email_aliases`
  - `client_authorized_senders`
  - upgraded inbound message table
  - attachment linkage table if current structure is insufficient
  - tenant job configuration table
- Migrate any useful legacy mailbox/email data into new tables where possible.
- Mark old mailbox and inbox structures as transitional only until migration completes.

## Seed and demo impact

- Seed at least:
  - two operational mailboxes,
  - three aliases mapped to business clients,
  - one authorized sender set,
  - one authorized inbound email,
  - one unauthorized sender email,
  - one ambiguous route email,
  - one email already converted to pre-entry.
- Remove demo copy that says mailbox ingestion is disabled.

## Tests first

- Unit, alias and sender priority resolution.
- Unit, unauthorized sender classification.
- Unit, ambiguous route classification.
- API, mailbox CRUD and connection validation.
- API, inbox listing and detail scoped by tenant.
- API, processing batch creates pre-entry and never definitive external launch.
- API, duplicate inbound message detection by message id and content hash.
- E2E, email enters inbox, becomes pre-entry, appears in approval queue.
- E2E, unauthorized sender lands in review with alert.

## Exit criteria

- Gmail/Workspace operational inboxes are primary supported intake path.
- Inbox route works end-to-end from stored inbound message to linked pre-entry.
- Routing follows alias plus sender priority from target doc.
- Batch processing and inbox metrics exist per tenant.
- Active Actions no longer defines main product behavior.
