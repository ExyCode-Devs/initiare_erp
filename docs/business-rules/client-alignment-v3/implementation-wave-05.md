# Implementation Wave 05, Advanced Modules On Target Flow

## Target rules

- `RULE-032`
- `RULE-033`
- `RULE-034`
- `RULE-035`
- `RULE-037`
- `RULE-040`
- `RULE-041`
- `RULE-042`
- `RULE-044`

## Goal

Build advanced product modules directly on target-doc operational flow already established in Waves 01 to 04:

- Gmail intake or system sync creates pre-entry,
- operator reviews in one queue,
- approval triggers definitive external execution,
- analytics and portal consume same operational truth.

No advanced module may create side workflows outside target intake, pre-entry, and execution contracts.

## Canonical advanced-module contract

All advanced modules must follow one pattern:

1. Source event or sync detects operational opportunity.
2. System creates or updates normalized pre-entry or reconciliation work item.
3. Operator reviews or confirms when human validation is required.
4. Approved item executes through same downstream execution framework.
5. Analytics, alerts, and portal views read same persisted operational facts.

This applies to:

- recurring contract billing,
- OMIE service orders,
- reconciliation and fees,
- multi-CNPJ allocation,
- BI,
- client portal.

## Backend tasks

### Contracts receivable engine

- Sync active OMIE contracts into internal contract snapshot model.
- Detect contracts due for billing by configured schedule.
- Generate `receivable` pre-entries, never direct definitive billing records.
- Support operator decisions:
  - approve and bill,
  - postpone,
  - ignore,
  - correct source data.
- Persist billing-day reason and contract snapshot used at generation time.

### OMIE service-order receivable engine

- Sync faturavel OMIE OS items into internal work model.
- Detect if billing already exists before creating new pre-entry.
- Create `receivable` pre-entries with origin `omie_os`.
- Keep OS-to-pre-entry and OS-to-definitive-billing linkage auditable.

### Reconciliation engine

- Import bank or provider movement on daily schedule.
- Match movement against definitive payables and receivables already executed.
- Classify:
  - auto-reconciled,
  - pending,
  - divergent,
  - fee,
  - duplicate,
  - ignored.
- Allow unmatched movement to create new pre-entry when business rule requires it.
- Surface fee linkage from Asaas charges to reconciliation items.

### Multi-CNPJ distribution engine

- Introduce target domain for:
  - `business_clients`
  - `business_client_entities`
  - allocation rules
  - monthly cap rules
- Support allocation strategies from target doc:
  - percentage
  - class or group based
  - value-band based
  - manual override
  - monthly cap by CNPJ
- Ensure billing generation chooses entity by persisted allocation rule, not hardcoded branch logic.

### BI foundation

- Build analytical pipeline from normalized operational tables:
  - inbox volumes,
  - pre-entry outcomes,
  - approval times,
  - execution success or error,
  - reconciliation outcomes,
  - contract and OS billing activity,
  - per-business-client volumes.
- Define analytical grain at:
  - tenant
  - legal entity
  - business client
  - operator
  - day and month
- Use same operational IDs so BI can drill back to source workflow items.

### Client portal

- Add external client-facing auth model restricted to business-client scope.
- Expose read-safe views only:
  - billing and receivable status,
  - reports and BI slices,
  - requests or uploaded documents when allowed.
- Never allow portal user to cross tenant or cross business-client boundary.
- Route portal-generated requests into same intake and pre-entry or task framework when applicable.

## Frontend tasks

### Operator surfaces

- Add contract billing day screen using shared review queue semantics.
- Add OS billing screen or queue filters using same pre-entry detail pattern.
- Add reconciliation screen with:
  - movement details
  - match suggestions
  - fee grouping
  - manual link flow
  - create-pre-entry action for unmatched items
- Add business-client and multi-CNPJ allocation management screens under settings or cadastros.

### Analytics surfaces

- Add client-level BI filters and drill-down based on operational facts, not separate mock aggregates.
- Add daily operator view that combines:
  - inbox pending count
  - pre-entry pending review
  - contract billing due
  - OS billing due
  - reconciliation exceptions
  - provider failures

### Portal surfaces

- Add limited client portal navigation:
  - overview
  - receivables or billing history
  - reports
  - document or request area if implemented
- Keep portal wording aligned with target business model, not internal admin jargon.

## Schema and data tasks

- Introduce target tables required for advanced modules:
  - contract snapshot and billing work tables
  - OS snapshot and billing work tables
  - reconciliation movement and match tables
  - fee linkage tables if current provider sync records are insufficient
  - `business_clients`
  - `business_client_entities`
  - `payers`
  - `financial_categories`
  - `departments`
  - allocation rule tables
  - analytical snapshot or fact tables as needed
  - portal access and permission tables
- Keep every table tenant-scoped unless truly global by platform design.
- Reuse pre-entry and execution ids as foreign keys where possible.

## Seed and demo impact

- Seed one business client with multiple CNPJs and allocation rules.
- Seed one contract due for billing.
- Seed one OMIE OS due for billing.
- Seed one successful reconciliation match.
- Seed one unmatched bank movement that creates review work.
- Seed one Asaas fee-linked reconciliation case.
- Seed one portal-visible business client with limited data slice.
- Seed BI examples tied to real operational item ids.

## Tests first

- Unit, contract due-date detection and duplicate suppression.
- Unit, OS billing candidate detection.
- Unit, reconciliation matching and fee classification.
- Unit, multi-CNPJ allocation and cap enforcement.
- API, contract and OS pre-entry creation stays inside shared review flow.
- API, reconciliation create-pre-entry path respects tenant and business-client boundaries.
- API, portal user cannot access foreign tenant or foreign business-client data.
- API, BI queries are tenant-safe and business-client scoped.
- E2E, operator daily flow from due contract to approved billing execution.
- E2E, reconciliation exception resolved and linked correctly.
- E2E, portal user views only allowed business-client slice.

## Exit criteria

- Contracts, OS, reconciliation, BI, and portal all reuse target inbox, pre-entry, and execution architecture.
- Multi-CNPJ distribution is configuration-driven and audited.
- BI is drillable back to operational truth.
- Portal is strictly scoped and cannot leak tenant or client data.
- No advanced module introduces parallel non-reviewed financial execution flow.
