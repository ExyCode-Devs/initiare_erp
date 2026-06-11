# Validation Backlog

## Blockers To Decide Before Behavior Changes

### Intake model

1. Should product stay Active Actions first, restore Gmail/Workspace first, or support both?
2. If Gmail/Workspace returns, which operational inboxes enter MVP first?
3. Are alias to client mappings already documented outside this repo?
4. Is authorized-sender validation mandatory in MVP or later?

### Approval and execution

5. After approval, should system:
   - create only local definitive record,
   - queue automatic OMIE/Asaas execution,
   - or require explicit execute action?
6. Does receivable approval create record in OMIE, Asaas, or internal base first?
7. Should manual OMIE export remain available even if auto queue is later added?

### Domain boundaries

8. Is current `Client` model meant to become target `business_client`, or should new table be introduced?
9. Is `LegalEntity` the right place for operational CNPJ scope long-term, or only transition layer?
10. Which role set is target for near-term MVP:
   - current `ADMIN/ANALYST/VIEWER`,
   - expanded tenant roles,
   - or platform plus tenant roles now?

### Receivable and billing flow

11. Which receivable sources are MVP:
   - email only,
   - OMIE contracts,
   - OMIE OS,
   - Asaas sync,
   - all of them?
12. Who owns boleto generation in target flow, OMIE, Asaas, or ERP-managed abstraction?
13. Who owns receivable email send, OMIE, Asaas, or ERP?

### Fiscal and multi-CNPJ

14. Which fiscal-note path is target first, Asaas, OMIE, or direct government/API?
15. Which clients require multi-CNPJ distribution in first release?
16. Is monthly emission cap a real near-term rule or temporary exception only?

## Safe Defaults Until Validated

- Treat target doc as desired behavior for conflict rows.
- Move toward Gmail/Workspace operational intake, not permanent Active Actions-first intake.
- Move toward approval triggering definitive external flow, not permanent local-only approval outcome.
- Keep `Company` as tenant root and `LegalEntity` as current operational routing scope.
- Treat `Client` as transitional model, not yet final `business_client`.
- Do not add platform super-admin schema until product owner confirms platform-level operations are in scope now.

## Suggested Validation Sequence

1. Intake strategy.
2. Approval-to-execution contract.
3. Role and domain model boundary.
4. Receivable ownership, OMIE vs Asaas.
5. Multi-CNPJ and invoicing exceptions.
