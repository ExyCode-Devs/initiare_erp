# Arquitetura do MVP Initiare ERP

## Stack

- frontend SSR com TanStack Start
- API Fastify
- Postgres
- Prisma para schema e migrations
- JWT + RBAC
- worker separado no mesmo codebase da API
- n8n como gateway de extracao financeira
- deploy de producao por pull de imagem, sem build na VPS

## Servicos

### web

- entrega frontend autenticado
- consome `/api`
- mostra dashboard, inbox financeiro, validacao e novidades

### api

- autentica usuarios
- aplica RBAC `ADMIN`, `ANALYST`, `VIEWER`
- expoe rotas do produto e observabilidade
- persiste drafts, changelog, mailboxes, auditoria

### worker

- roda polling IMAP
- salva `.eml` e anexos em volume local
- extrai texto de PDF
- chama webhook privado do n8n
- valida JSON retornado
- calcula confianca
- cria drafts financeiros
- fica desligado por padrao em producao ate fase E2E

### postgres

- persiste dominio financeiro, filas, revisoes e changelog

## Pipeline financeiro

1. worker busca emails novos em mailboxes IMAP ativas
2. app deduplica por `messageId` e hash
3. app salva email original e anexos em `/data/financial-ingestion`
4. app extrai texto de PDF
5. app chama n8n com bearer token
6. app valida JSON com Zod
7. app calcula score e faixa de confianca
8. app cria `FinancialDraft`
9. humano revisa, aprova ou rejeita
10. app escreve `AccountPayable` ou `AccountReceivable` quando aprovado

## Modelos novos

- `MailboxAccount`
- `InboundEmail`
- `EmailAttachment`
- `ActivepiecesExtractionRun` mapped to DB table `N8nExtractionRun`
- `FinancialDraft`
- `FinancialDraftReview`
- `ProcessingJobRun`
- `ChangelogEntry`
- `ChangelogRead`

## Rotas principais

- `GET /api/mailboxes`
- `POST /api/mailboxes`
- `PATCH /api/mailboxes/:id`
- `POST /api/mailboxes/:id/test`
- `POST /api/mailboxes/:id/sync`
- `GET /api/inbox/emails`
- `GET /api/inbox/emails/:id`
- `GET /api/attachments/:id/download`
- `GET /api/financial-drafts`
- `GET /api/financial-drafts/:id`
- `PATCH /api/financial-drafts/:id`
- `POST /api/financial-drafts/:id/approve`
- `POST /api/financial-drafts/:id/reject`
- `GET /api/automation/summary`
- `GET /api/changelog`
- `POST /api/changelog/:id/mark-seen`
- `GET /api/admin/changelog`
- `POST /api/admin/changelog`
- `PATCH /api/admin/changelog/:id`
- `POST /api/admin/changelog/:id/publish`
- `GET /api/monitoring/summary`
- `GET /metrics`

## Variaveis novas

- `ACTIVEPIECES_EXTRACTION_WEBHOOK_URL`
- `ACTIVEPIECES_EXTRACTION_BEARER_TOKEN`
- `ACTIVEPIECES_TIMEOUT_MS`
- `MAILBOX_SECRET_KEY`
- `WORKER_POLL_INTERVAL_MS`
- `WORKER_BATCH_SIZE`
- `INGESTION_STORAGE_ROOT`
- `MAX_ATTACHMENT_SIZE_MB`
- `SEED_ANALYST_EMAIL`
- `SEED_ANALYST_PASSWORD`
- `SEED_VIEWER_EMAIL`
- `SEED_VIEWER_PASSWORD`

## Bootstrap

- `prisma/bootstrap.ts`
  - cria empresa e admin quando banco esta vazio
  - pode criar analyst e viewer se variaveis existirem
  - nao cria drafts, mailboxes, changelog, clientes ou mock financeiro
- `prisma/seed.ts`
  - fica reservado para demo local

## Docker

- `docker-compose.yml`
  - `web`
  - `api`
  - `worker`
  - `postgres`
- `docker-compose.prod.yml`
  - `web` atras do Traefik
  - `api` atras de `PathPrefix(/api)`
  - `worker` com profile, desligado por padrao
  - `postgres` interno
- volume compartilhado:
  - `ingestion_data:/data`

## Observabilidade

- logs estruturados na API e worker
- `ProcessingJobRun` para estado do worker
- `AuditLog` para aprovacao, rejeicao, changelog e mailbox sync
- `/api/monitoring/summary`
- `/metrics`
