Endpoint for receiving invoices from Lovable / n8n automation.

POST /api/webhooks/invoices
- Accepts JSON body matching src/types/contas.ts

GET /api/webhooks/invoices
- Returns stored invoices (in-memory) as JSON array.

Example POST body:
```
{
  "id": "inv_123",
  "fornecedor": "ACME Ltda",
  "valor": 1234.56,
  "vencimento": "2026-05-30",
  "categoria": "Serviços",
  "status": "Pendente",
  "confianca": 87
}
```

Notes:
- This is a development-only in-memory store. For production, persist to a DB and add auth/verification.
- Configure your n8n HTTP Request node to POST JSON to: https://your-domain.com/api/webhooks/invoices

