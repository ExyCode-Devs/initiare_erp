# Deploy na Hostinger com pull de imagem

## Resumo

`initiare_erp` em producao sobe com:

1. `web`
2. `api`
3. `postgres`
4. Traefik roteando `/` para `web` e `/api` para `api`

Build pesado nao roda mais na VPS. O fluxo novo builda no GitHub, publica no Docker Hub, e o servidor apenas faz `pull` e `up`.

Arquivos principais:

- `Dockerfile`
- `api/Dockerfile`
- `docker-compose.prod.yml`
- `deploy/hostinger/.env.production.example`
- `deploy/hostinger/deploy.sh`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-hostinger.yml`

## Arquitetura de deploy

- caminho canonico no servidor: `/source/initiare_erp`
- `web`
  - frontend SSR
  - porta interna `3000`
- `api`
  - Fastify + Prisma
  - porta interna `4000`
- `postgres`
  - interno

## Rotas publicas esperadas

- `https://SEU_HOST/` -> `web`
- `https://SEU_HOST/api/*` -> `api`

## Variaveis de producao

Crie `/source/initiare_erp/.env` no servidor com base em:

- `deploy/hostinger/.env.production.example`

Exemplo:

```dotenv
WEB_CONTAINER_NAME=initiare_erp-web
API_CONTAINER_NAME=initiare_erp-api
DB_CONTAINER_NAME=initiare_erp-postgres
WEB_IMAGE=docker.io/exycode/initiare-erp
API_IMAGE=docker.io/exycode/initiare-erp-api
IMAGE_TAG=latest
WEB_PORT=3000
API_PORT=4000
TRAEFIK_HOST=initiare.exycode.com.br
TRAEFIK_CERTRESOLVER=letsencrypt
TRAEFIK_NETWORK=proxy
HOST=0.0.0.0
HOSTNAME=0.0.0.0
NODE_ENV=production
POSTGRES_DB=initiare_erp
POSTGRES_USER=veridia
POSTGRES_PASSWORD=trocar-antes-de-subir
DATABASE_URL=postgresql://veridia:trocar-antes-de-subir@postgres:5432/initiare_erp?schema=public
JWT_SECRET=trocar-por-um-segredo-longo-com-no-minimo-32-caracteres
APP_ORIGIN=https://initiare.exycode.com.br
SEED_COMPANY_NAME=Initiare ERP
SEED_COMPANY_DOMAIN=initiare.exycode.com.br
SEED_ADMIN_EMAIL=admin@exycode.com.br
SEED_ADMIN_PASSWORD=ChangeMe123!
API_LOG_LEVEL=info
```

## Segredos do GitHub

No repo `ExyCode-Devs/initiare_erp`, configurar:

- `HOSTINGER_HOST`
- `HOSTINGER_PORT`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_KEY`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `WEB_IMAGE`
- `API_IMAGE`

Exemplo:

```text
HOSTINGER_HOST=31.97.175.6
HOSTINGER_PORT=22
HOSTINGER_USER=ia-usuario
WEB_IMAGE=docker.io/exycode/initiare-erp
API_IMAGE=docker.io/exycode/initiare-erp-api
```

## Primeira configuracao no servidor

1. garantir pasta `/source/initiare_erp`
2. garantir Docker e Docker Compose plugin
3. garantir rede Docker `proxy`
4. criar `.env` de producao
5. garantir que imagens do Docker Hub estao acessiveis

Se a rede nao existir:

```bash
docker network create proxy
```

## CI e deploy

### CI

1. instala dependencias de `web`
2. instala dependencias de `api`
3. roda `npm run build`
4. valida `docker-compose.prod.yml`
5. valida build Docker do `web`
6. valida build Docker da `api`

### Deploy

1. builda imagem `web` no GitHub
2. builda imagem `api` no GitHub
3. faz push com tag do commit e `latest`
4. sincroniza repo via `rsync`
5. entra por SSH
6. roda `docker compose pull web api`
7. sobe `postgres`
8. roda `prisma migrate deploy`
9. roda bootstrap minimo quando banco estiver vazio
10. sobe `web` e `api`
11. remove worker antigo, se existir

## Comandos uteis no servidor

```bash
cd /source/initiare_erp
docker compose --env-file .env -f docker-compose.prod.yml config
docker compose --env-file .env -f docker-compose.prod.yml pull web api
docker compose --env-file .env -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env -f docker-compose.prod.yml run --rm --no-deps api npx prisma migrate deploy
docker compose --env-file .env -f docker-compose.prod.yml run --rm --no-deps api node dist/prisma/bootstrap.js
docker compose --env-file .env -f docker-compose.prod.yml up -d web api --remove-orphans
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f web
docker compose --env-file .env -f docker-compose.prod.yml logs -f api
docker compose --env-file .env -f docker-compose.prod.yml logs -f postgres
```

## Validacao minima

Depois do deploy:

1. abrir `https://initiare.exycode.com.br/login`
2. validar `https://initiare.exycode.com.br/api/health`
3. testar login admin
4. confirmar ausencia de dados demo de negocio
5. abrir dashboard

## Bootstrap inicial

Bootstrap usa valores do `.env`, mas roda so quando banco estiver vazio.

Trocar antes de liberar cliente:

- `SEED_ADMIN_PASSWORD`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
