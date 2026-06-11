# Implementation Wave 01, Target Model Foundations

## Target rules

- `RULE-001`
- `RULE-002`
- `RULE-003`
- `RULE-004`
- `RULE-005`
- `RULE-006`
- `RULE-043`
- `RULE-045`
- `RULE-046`

## Goal

Prepare repo foundations for target-doc architecture before Gmail intake, pre-entry workflow, and execution queue land:

- tenant-safe model stays mandatory,
- target business vocabulary becomes official,
- schema expansion path is defined,
- current repo structures are classified as migration inputs, not final product model,
- security and audit guarantees are locked before feature expansion.

## Canonical foundation contract

This wave establishes these truths:

- `Company` remains current tenant root until platform layer is explicitly added.
- Current `Client` is not final target `business_client`.
- Current `LegalEntity` is operational CNPJ scope, but target domain will also require business-client and multi-entity grouping.
- New work must be designed for target-doc model, even if migration is phased.
- Every new route and table must preserve strict tenant isolation and auditable actions.

## Backend tasks

- Publish authoritative target-domain glossary in repo docs and contributor notes:
  - tenant
  - tenant user
  - business client
  - business client entity
  - end customer or payer
  - supplier
  - operational mailbox
  - pre-entry
  - definitive external execution
- Add architecture note in backend docs stating current-to-target mapping:
  - `Company` -> current tenant root
  - `User` -> current tenant user
  - `Client` -> legacy placeholder, not final business-client model
  - `LegalEntity` -> operational CNPJ scope
  - `FinancialDraft` -> legacy pre-entry precursor
- Define migration baseline for target tables that later waves depend on:
  - `business_clients`
  - `business_client_entities`
  - `operational_mailboxes`
  - `client_email_aliases`
  - `client_authorized_senders`
  - `financial_pre_entries`
  - `financial_pre_entry_attachments`
  - `financial_pre_entry_audit_logs`
  - `jobs`
- Add explicit backend checklist for all protected handlers:
  - always filter by `companyId`
  - never trust frontend tenant context
  - never allow cross-tenant relation writes
  - never expose raw provider secrets
- Add or expand auth and authorization tests for:
  - wrong-tenant draft access
  - wrong-tenant legal-entity access
  - wrong-tenant OMIE settings access
  - wrong-tenant Asaas settings access
  - wrong-role mutation attempts
- Document current legacy routes and models that later waves will replace:
  - mailbox and inbox `410` handlers
  - Active Actions-first ingress assumptions
  - direct local financial record creation on approval
- Keep older docs like `docs/mvp-architecture.md` explicitly marked historical so new implementation does not regress to outdated assumptions.

## Frontend tasks

- Publish frontend architecture note aligned to target model:
  - inbox route will become primary intake surface,
  - review queue is pre-entry center,
  - settings will expand from legal-entity and provider config into tenant operational config,
  - current `clientes` screens must not assume final target `business_client` contract is already implemented.
- Add contributor guidance for labels and copy:
  - avoid calling current local records definitive external financial records,
  - avoid calling legacy draft model final pre-entry architecture,
  - use target business names in new UI work.

## Schema and data tasks

- Produce concrete migration sequence, not only glossary:
  1. add new target tables without deleting current ones,
  2. backfill tenant-safe links,
  3. switch reads and writes by module,
  4. remove legacy fields after cutover.
- Define required unique and index strategy up front for target model:
  - tenant plus business client uniqueness
  - tenant plus alias uniqueness
  - tenant plus sender uniqueness where applicable
  - tenant plus external-provider mapping uniqueness
  - tenant plus pre-entry lookup and status indexes
- Define secret-storage rule for Gmail, OMIE, and Asaas credentials:
  - encrypted at rest or secure reference only
  - never plain text in API response
  - audit log only metadata, never secrets

## Seed and demo impact

- Update seed strategy so new target-domain fixtures can coexist with current demo data.
- Plan seed additions for:
  - business client
  - multiple entities per business client
  - operational mailbox
  - alias
  - authorized sender
  - pre-entry and audit examples
- Do not keep seed naming that suggests current `Client` table already solves target business-client domain.

## Tests first

- Unit, tenant-scope helper coverage.
- API, forbidden cross-tenant access on all current financial and integration routes.
- API, wrong-role mutation attempts for settings and review actions.
- API, secret fields never echoed back in plaintext.
- E2E, viewer read-only behavior on queue and settings.

## Exit criteria

- Repo has one official target-domain vocabulary.
- Target schema expansion path is defined and ready for Wave 02 onward.
- Tenant isolation and role boundaries are covered by tests, not only inspection.
- New feature waves can build toward `business_clients`, inbox routing tables, pre-entries, and execution queue without redefining foundations.
