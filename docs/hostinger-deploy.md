# Deploy na Hostinger com Web + API + Postgres + Traefik

## Resumo

O Axiom agora foi convertido para um MVP com:

1. `web` separado da `api`
2. `api` Fastify com JWT, RBAC, Prisma e Postgres
3. migrations versionadas em `api/prisma/migrations`
4. seed inicial seguro para primeira subida
5. compose local em `docker-compose.yml`
6. compose de producao em `docker-compose.prod.yml`
7. roteamento Traefik por host + `PathPrefix(/api)`

Arquivos principais:

- `Dockerfile`
- `.dockerignore`
- `api/Dockerfile`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `deploy/hostinger/.env.production.example`
- `deploy/hostinger/deploy.sh`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-hostinger.yml`

## Arquitetura

- `web`
  - TanStack Start
  - login
  - dashboard e telas consumindo a API real
- `api`
  - Fastify
  - JWT
  - RBAC `ADMIN`, `ANALYST`, `VIEWER`
  - logs estruturados
  - metricas em `/metrics`
  - endpoints em `/api/*`
- `postgres`
  - persistencia do MVP

Roteamento esperado em producao:

- `https://SEU_HOST/` -> `web`
- `https://SEU_HOST/api/*` -> `api`

## Banco e migrations

O schema fica em:

- `api/prisma/schema.prisma`

A migration inicial fica em:

- `api/prisma/migrations/0001_init/migration.sql`

Comandos uteis:

```bash
npm --prefix api run prisma:migrate
npm --prefix api run prisma:seed
```

O seed:

- popula a base apenas se ela estiver vazia
- nao apaga dados existentes em reinicios normais
- so reseta tudo quando `SEED_RESET=true`

## Variaveis de ambiente de producao

No servidor, dentro da pasta do projeto, crie um `.env` com base em:

- `deploy/hostinger/.env.production.example`

Variaveis principais:

```bash
WEB_CONTAINER_NAME=axiom-prime-web
API_CONTAINER_NAME=axiom-prime-api
DB_CONTAINER_NAME=axiom-prime-postgres
WEB_IMAGE=axiom-prime-web:latest
API_IMAGE=axiom-prime-api:latest
WEB_PORT=3000
API_PORT=4000
TRAEFIK_HOST=mvp.exemplo.com.br
TRAEFIK_CERTRESOLVER=letsencrypt
TRAEFIK_NETWORK=proxy
POSTGRES_DB=axiom_prime
POSTGRES_USER=veridia
POSTGRES_PASSWORD=trocar-antes-de-subir
DATABASE_URL=postgresql://veridia:trocar-antes-de-subir@postgres:5432/axiom_prime?schema=public
JWT_SECRET=trocar-por-um-segredo-longo-com-no-minimo-32-caracteres
APP_ORIGIN=https://mvp.exemplo.com.br
SEED_ADMIN_EMAIL=admin@veridia.local
SEED_ADMIN_PASSWORD=ChangeMe123!
```

## Segredos no GitHub

No repositorio `ExyCode-Devs/axiom-prime`, configure:

- `HOSTINGER_HOST`
- `HOSTINGER_PORT`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_APP_DIR`

Exemplo:

```text
HOSTINGER_HOST=111.222.333.444
HOSTINGER_PORT=22
HOSTINGER_USER=deploy
HOSTINGER_APP_DIR=/home/deploy/apps/axiom-prime
```

## Primeira configuracao no servidor

1. Criar a pasta da app.
2. Garantir que Docker e Docker Compose plugin estao instalados.
3. Garantir que a rede `proxy` do Traefik existe.
4. Colocar o `.env` de producao dentro da pasta do projeto.

Se a rede ainda nao existir:

```bash
docker network create proxy
```

## DNS e subdominio

1. Criar o subdominio final do cliente.
2. Apontar o registro `A` para o IP do VPS.
3. Garantir que o Traefik do servidor esta responsavel por `80/443`.
4. Usar o mesmo host em `TRAEFIK_HOST` e `APP_ORIGIN`.

## O que a action faz

No CI:

1. instala dependencias de `web`
2. instala dependencias de `api`
3. roda `npm run build`
4. valida `docker build` do `web`
5. valida `docker build` da `api`

No deploy:

1. sincroniza o repo por `rsync`
2. entra no servidor por SSH
3. roda `docker compose --env-file .env -f docker-compose.prod.yml up -d --build --remove-orphans`

## Primeiro deploy

1. preencher o `.env` de producao
2. configurar os secrets do GitHub
3. garantir DNS apontando para o servidor
4. fazer push para `main`
5. acompanhar a action `Deploy Hostinger`

## Rollback

Para rollback:

1. abrir `Actions`
2. executar `Deploy Hostinger`
3. informar um `git_ref` anterior

## Comandos uteis no servidor

```bash
cd /home/SEU_USUARIO/apps/axiom-prime
docker compose --env-file .env -f docker-compose.prod.yml config
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f web
docker compose --env-file .env -f docker-compose.prod.yml logs -f api
docker compose --env-file .env -f docker-compose.prod.yml logs -f postgres
docker compose --env-file .env -f docker-compose.prod.yml down
```

## Acesso inicial

Usuario seed padrao:

- e-mail: `admin@veridia.local`
- senha: `ChangeMe123!`

Troque isso antes de liberar acesso real para o cliente.
