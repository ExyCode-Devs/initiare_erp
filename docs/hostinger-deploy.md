# Deploy na Hostinger com Docker e Traefik

## Resumo

Este projeto agora esta preparado para o padrao que voces usam hoje:

1. `Dockerfile` para build da app SSR
2. `docker-compose.prod.yml` com labels do Traefik
3. rede externa `proxy`
4. deploy por GitHub Actions via SSH
5. `docker compose up -d --build` no servidor

Arquivos principais:

- `Dockerfile`
- `.dockerignore`
- `docker-compose.prod.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-hostinger.yml`
- `deploy/hostinger/deploy.sh`
- `deploy/hostinger/.env.production.example`

## Limitacao atual do MVP

O endpoint `src/routes/api/webhooks/invoices.ts` continua usando armazenamento em memoria.

Isso significa:

- restart do container apaga os dados recebidos pelo webhook
- nao existe persistencia de banco ainda
- para a apresentacao pode servir

## O que ficou pronto

- build de aplicacao com `npm run build`
- build de imagem com `Dockerfile`
- compose de producao com Traefik
- healthcheck em `/api/health`
- workflow de CI validando build da app e build do container
- workflow de deploy rodando `docker compose` no servidor

## Arquivo `.env` do servidor

No servidor, dentro da pasta do projeto, crie um `.env` com base em `deploy/hostinger/.env.production.example`.

Exemplo:

```bash
APP_CONTAINER_NAME=axiom-prime
APP_IMAGE=axiom-prime:latest
APP_PORT=3000
TRAEFIK_HOST=mvp.exemplo.com.br
TRAEFIK_CERTRESOLVER=letsencrypt
TRAEFIK_NETWORK=proxy
HOST=0.0.0.0
HOSTNAME=0.0.0.0
NODE_ENV=production
```

Se futuramente a app tiver segredos, eles podem entrar nesse mesmo `.env`.

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

1. Criar a pasta da app
2. Garantir que Docker e Docker Compose plugin estao instalados
3. Garantir que a rede do Traefik existe
4. Criar o `.env`

Se a rede ainda nao existir:

```bash
docker network create proxy
```

## DNS e subdominio

1. Criar o subdominio da demo
2. Apontar o registro `A` para o IP do VPS
3. Garantir que o Traefik desse servidor esteja configurado para `web` e `websecure`
4. Usar `TRAEFIK_HOST` com o subdominio final

## Primeiro deploy

1. Fazer push para `main`
2. Ou executar manualmente o workflow `Deploy Hostinger`

O workflow vai:

1. validar `npm run build`
2. validar `docker build`
3. sincronizar o repo por `rsync`
4. entrar no servidor por SSH
5. rodar `docker compose --env-file .env -f docker-compose.prod.yml up -d --build --remove-orphans`

## Rollback

Para rollback:

1. abrir `Actions`
2. executar `Deploy Hostinger`
3. informar um `git_ref` anterior

## Comandos uteis no servidor

```bash
cd /home/SEU_USUARIO/apps/axiom-prime
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f web
docker compose --env-file .env -f docker-compose.prod.yml down
```
