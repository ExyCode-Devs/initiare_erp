# Deploy na Hostinger

## Resumo

Este projeto e um app SSR em `TanStack Start`. Ele nao deve ser tratado como site HTML estatico puro.

O caminho recomendado para o MVP e:

1. Hospedar como app Node.js
2. Colocar um subdominio para a demo
3. Apontar DNS para a Hostinger
4. Publicar via GitHub Actions por SSH
5. Rodar em background com PM2

Os arquivos desta automacao ja foram adicionados ao repo:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-hostinger.yml`
- `ecosystem.config.cjs`
- `deploy/hostinger/deploy.sh`
- `deploy/hostinger/.env.production.example`

## Limitacao atual do MVP

O endpoint `src/routes/api/webhooks/invoices.ts` usa armazenamento em memoria. Isso significa:

- qualquer restart do processo perde os dados recebidos pelo webhook
- nao existe persistencia de banco ainda
- para a apresentacao isso pode servir, mas nao e deploy de producao

## O que ja ficou pronto no repo

- `npm run build` agora inclui `tsc --noEmit`
- `npm run start` sobe o servidor Node em `.output/server/index.mjs`
- workflow de CI para validar build no GitHub
- workflow de deploy para Hostinger via SSH
- configuracao de processo com PM2
- exemplo de `.env.production`

## Cenarios possiveis na Hostinger

### Opcao recomendada: VPS

Use esta opcao se voces tem um servidor VPS da Hostinger. E o melhor encaixe para esse projeto.

### Opcao alternativa: Web/Cloud hosting com Node.js gerenciado

A Hostinger hoje tambem suporta app Node.js em alguns planos Web/Cloud. Se o ambiente de voces for esse, o repo agora ja esta mais preparado porque tem `build` e `start`, mas a automacao por SSH deste repo foi pensada para VPS.

## Passo 1: criar o subdominio

Se o dominio estiver usando nameserver da Hostinger:

1. Entre no hPanel
2. Abra `Websites` ou `Domains`, dependendo do painel da conta
3. Crie o subdominio da demo, por exemplo `mvp.seudominio.com`

Se o dominio estiver em nameserver externo, como Cloudflare:

1. Crie o subdominio no painel que gerencia o DNS
2. Aponte o subdominio para o IP do VPS com um registro `A`

Referencias oficiais:

- Hostinger subdominios: https://www.hostinger.com/support/1583405-how-to-create-and-delete-subdomains-in-hostinger/
- Hostinger apontamento para VPS: https://www.hostinger.com/support/1583227-how-to-point-a-domain-to-your-vps-at-hostinger/

## Passo 2: preparar o site Node.js no servidor

Se voces usam VPS com CloudPanel ou template Node.js da Hostinger:

1. Criem um site Node.js para o subdominio
2. Escolham a versao de Node 22, ou no minimo Node 20
3. Definam uma pasta de app no servidor, por exemplo:

```bash
/home/SEU_USUARIO/apps/axiom-prime
```

4. Definam a porta interna da app, por exemplo `3000`
5. Emitam o SSL do subdominio

Referencia oficial:

- Node.js na Hostinger: https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/
- SSL em VPS: https://www.hostinger.com/support/6360129-how-to-install-ssl-on-vps-at-hostinger/

## Passo 3: criar os segredos no GitHub

No repositorio `ExyCode-Devs/axiom-prime`, crie estes `Actions secrets`:

- `HOSTINGER_HOST`: IP ou hostname do servidor
- `HOSTINGER_PORT`: porta SSH, normalmente `22`
- `HOSTINGER_USER`: usuario SSH do deploy
- `HOSTINGER_SSH_KEY`: chave privada do usuario que vai publicar
- `HOSTINGER_APP_DIR`: pasta da app no servidor
- `HOSTINGER_APP_PORT`: porta interna da app, por exemplo `3000`

Exemplo:

```text
HOSTINGER_HOST=111.222.333.444
HOSTINGER_PORT=22
HOSTINGER_USER=deploy
HOSTINGER_APP_DIR=/home/deploy/apps/axiom-prime
HOSTINGER_APP_PORT=3000
```

## Passo 4: criar o arquivo de ambiente no servidor

No servidor, dentro da pasta da app, crie um `.env.production` com base em `deploy/hostinger/.env.production.example`.

Exemplo:

```bash
HOST=0.0.0.0
PORT=3000
PM2_APP_NAME=axiom-prime
```

Se depois houver segredo real, ele deve ficar nesse arquivo e nao no Git.

## Passo 5: primeiro deploy

Depois dos segredos configurados:

1. Faça push na branch `main`
2. Ou rode manualmente o workflow `Deploy Hostinger`

O workflow vai:

1. Fazer checkout do commit
2. Rodar `npm ci`
3. Rodar `npm run build`
4. Sincronizar os arquivos por `rsync`
5. Entrar no servidor por SSH
6. Rodar `deploy/hostinger/deploy.sh`
7. Subir ou recarregar a app no PM2

## Rollback

Se a demo quebrar, faca rollback pelo proprio workflow:

1. Abra `Actions`
2. Rode `Deploy Hostinger`
3. Preencha `git_ref` com uma tag, branch ou commit SHA anterior

## Comandos uteis no servidor

```bash
cd /home/SEU_USUARIO/apps/axiom-prime
bash deploy/hostinger/deploy.sh
npx --yes pm2 status
npx --yes pm2 logs axiom-prime
npx --yes pm2 restart axiom-prime
```

## Quando a automacao deste repo nao se aplica

Se a conta de voces nao for VPS e nao tiver SSH liberado, use o deploy Node.js gerenciado do proprio hPanel. Nesse caso:

1. conecte o repo no painel da Hostinger
2. use `npm install`
3. configure `build command` como `npm run build`
4. configure `start command` como `npm run start`

Referencia oficial:

- Git deploy da Hostinger: https://support.hostinger.com/en/articles/1583302-how-to-deploy-a-git-repository
