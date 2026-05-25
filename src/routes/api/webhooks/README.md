Endpoint for receiving invoices from n8n automation (via Smee when running local).

POST /api/webhooks/invoices
- Accepts **one invoice per request** (flat JSON object).
- Performs payload validation and normalization.
- Upserts by `id` into local in-memory storage.

GET /api/webhooks/invoices
- Returns stored invoices (in-memory) as JSON array, ordered by `vencimento`.

GET /api/webhooks/invoices?diagnostics=1
- Returns ingestion diagnostics (`received`, `created`, `updated`, `rejected`, `itemsInStore`, `lastReceivedAt`).

Accepted POST body (single object):
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

Also accepted (n8n/Gmail variant):
```
{
  "id": "inv_1779680218442_y0glm1h",
  "fornecedo": "Felipe Firmo",
  "valor": 1000,
  "vencimento": null,
  "dataRecebimento": "2026-05-25T03:27:18.000Z",
  "categoria": "Serviços",
  "status": "risco",
  "confianca": 30
}
```

Validation rules:
- `id`: required non-empty string
- supplier can be sent as `fornecedor` (preferred) or `fornecedo` (legacy/n8n typo compatibility)
- `valor`: required finite number
- date fallback: uses `vencimento`, and if absent/null, uses `dataRecebimento`; if still missing, current timestamp
- `status`: normalized to internal statuses (`risco` => `Em revisão`)
- `confianca`: optional, defaults to `0`, valid range `0..100`
- Arrays are rejected (this endpoint expects exactly one invoice object per request)

Development: forwarding cloud n8n webhooks to local dev with Smee
-----------------------------------------------------------------

Use Smee as a bridge from your cloud n8n workflow to your local app endpoint `/api/webhooks/invoices`.

How it works
- n8n (cloud) sends invoice HTTP requests to your Smee channel URL.
- Local `smee-client` listens and forwards each request to your local endpoint.
- The app validates and stores invoices in memory, available immediately via GET.

Configuration (dev scripts)
- `SMEE_URL`: URL provided by smee.
- Script target is `http://localhost:8080/api/webhooks/invoices` (configured in `package.json`).

Setup
1) Install dev dependencies locally:

Windows (cmd.exe):
```
npm install --save-dev smee-client cross-env
```

2) Run the app with webhook forwarding:
- `npm run dev`
- Or: `npm run dev:smee`

3) In n8n cloud, configure your HTTP Request/Webhook target as your Smee URL.

Testing checklist
1) Send one invoice from n8n cloud to Smee URL.
2) Check ingestion stats:
   - `GET http://localhost:8080/api/webhooks/invoices?diagnostics=1`
3) Check stored data:
   - `GET http://localhost:8080/api/webhooks/invoices`
4) Open UI page `/contas-a-pagar` and confirm invoice appears.

Notes & safety
- This endpoint currently has **no authentication** (by project decision for now).
- Do not expose local forwarding publicly without network controls.
- In-memory storage is ephemeral and resets on app restart.

Files involved in this flow:
- [`src/lib/invoices-webhook.ts`](src/lib/invoices-webhook.ts:1) — webhook receiver + validation + in-memory upsert + diagnostics.
- [`src/server.ts`](src/server.ts:1) — intercepts `/api/webhooks/invoices` before SSR routing and delegates to webhook handler.
- [`src/routes/contas-a-pagar.tsx`](src/routes/contas-a-pagar.tsx:22) — reads the stored invoices from GET endpoint.
- [`package.json`](package.json:8) — smee forwarding scripts for local development.
