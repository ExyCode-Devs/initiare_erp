# Wave 01 Foundations

This file is the implementation anchor for Wave 01. Target-doc vocabulary wins for future work. Current repo names stay only as transitional mapping until schema and UI migration are complete.

## Authoritative Glossary

- `tenant`: the contracted company that owns users, data, integrations, operational configuration, and audit scope. Current repo root is `Company`.
- `tenant user`: an authenticated internal user of one tenant. Current repo root is `User`.
- `business client`: the end customer account operated by the tenant. This is broader than current `Client` and must not be confused with the contracting tenant.
- `payer` and `supplier`: financial counterparties involved in receivable and payable flows.
- `legal entity`: one CNPJ under the tenant used for operational routing, fiscal scope, and provider credentials. Current repo root is `LegalEntity`.
- `financial pre-entry`: the review-stage record that exists before definitive downstream execution. Current repo root is `FinancialDraft`.
- `definitive execution`: the validated downstream creation or sync that happens only after approved target flow rules allow it.

## Current To Target Mapping

| Current repo concept | Target-doc meaning | Wave 01 direction |
| --- | --- | --- |
| `Company` | `tenant` | Keep as root boundary now. |
| `User` | `tenant user` | Keep current auth scope, expand roles later. |
| `LegalEntity` | `legal entity` | Keep, but treat recipient aliases and authorized senders as future dedicated models. |
| `FinancialDraft` | `financial pre-entry` | Keep as transitional review object. |
| `Client` | not full `business client` yet | Do not stretch current model to cover target-doc needs. |
| `MailboxAccount` | legacy inbox connector | Treat as legacy until target intake model is validated in later waves. |

## Wave 01 Backend Rules

- Every new route must derive tenant scope from `request.user.companyId`.
- No write path may trust tenant identifiers coming from frontend payload alone.
- Cross-tenant relation writes are invalid even when IDs exist.
- Integration responses must expose capability flags, never raw secrets or cipher text.
- Review-stage data remains local and auditable until later waves define definitive execution behavior.

## Migration Baseline

Wave 01 does not add target tables yet. It locks the migration sequence:

1. Introduce dedicated target tables without breaking current review flow.
2. Backfill tenant-safe and legal-entity-safe links.
3. Move routing aliases and sender authorization out of `LegalEntity` JSON fields.
4. Keep legacy reads behind compatibility adapters until frontend and APIs switch fully.

Candidate target tables for upcoming waves:

- `business_clients`
- `business_client_entities`
- `operational_mailboxes`
- `client_email_aliases`
- `client_authorized_senders`
- `financial_pre_entries`
- `jobs`

## Frontend Guidance

- New labels, filters, and screens should prefer `tenant`, `business client`, `legal entity`, and `pre-entry`.
- Existing screens may keep legacy labels only where backend contracts still use old names.
- Settings UX should be treated as tenant operational configuration, not only legal-entity forms.
- Do not restore disabled IMAP inbox product behavior unless target-doc validation explicitly approves it.
