# Arquitetura do MVP Initiare ERP

## Stack

- Frontend SSR: TanStack Start
- API: Fastify
- Banco: Postgres
- ORM e migrations: Prisma
- Auth: JWT + RBAC
- Observabilidade:
  - request logging estruturado
  - `/api/monitoring/summary`
  - `/metrics`

## Servicos

### web

- entrega o frontend
- exibe login
- consome a API em `/api`

### api

- autentica usuarios
- entrega os dados das telas
- aplica controle de acesso
- roda migrations no boot
- semeia a base apenas quando vazia

### postgres

- persiste todo o MVP

## Rotas principais da API

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/overview`
- `GET /api/executive/overview`
- `GET /api/operations`
- `GET /api/accounts-payable`
- `GET /api/accounts-receivable`
- `GET /api/clients`
- `GET /api/suppliers`
- `GET /api/reconciliation`
- `GET /api/exceptions`
- `PATCH /api/exceptions/:id`
- `GET /api/ai/overview`
- `GET /api/ai/logs`
- `GET /api/automations`
- `PATCH /api/automations/:id`
- `GET /api/flows`
- `GET /api/reports`
- `GET /api/settings`
- `GET /api/monitoring/summary`
- `GET /api/health`

## Deploy

- local: `docker-compose.yml`
- producao: `docker-compose.prod.yml`
- traefik:
  - host principal para `web`
  - `PathPrefix(/api)` para `api`
