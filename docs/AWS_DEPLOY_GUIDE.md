# EKIP - Guia de Deploy na AWS

> **Versão**: 1.0  
> **Data**: Fevereiro 2026  
> **Autor**: Via Consulting

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Pré-requisitos](#pré-requisitos)
4. [Checklist Completo](#checklist-completo)
5. [Detalhamento por Fase](#detalhamento-por-fase)
6. [Variáveis de Ambiente](#variáveis-de-ambiente)
7. [CI/CD com GitHub Actions](#cicd-com-github-actions)
8. [Troubleshooting](#troubleshooting)
9. [Custos Estimados](#custos-estimados)

---

## Visão Geral

Deploy minimalista da plataforma EKIP usando apenas os serviços essenciais:

| Componente | Tecnologia | Serviço AWS |
|------------|------------|-------------|
| **Frontend** | React + Vite (SPA) | S3 + CloudFront |
| **Backend** | Node.js + Express | App Runner |
| **Banco de Dados** | PostgreSQL | Supabase (externo) |
| **Auth + Realtime** | Supabase Auth | Supabase (externo) |
| **DNS** | — | Route 53 |
| **SSL** | — | ACM (Certificate Manager) |

### O que NÃO é necessário

- ❌ Docker/Containers (App Runner gerencia isso)
- ❌ ECS/EKS (complexidade desnecessária)
- ❌ RDS (Supabase já fornece PostgreSQL)
- ❌ Redis (não utilizado no projeto)
- ❌ Prisma (código usa Supabase diretamente)

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Route 53 (DNS)                               │
│         ekip.viaconsulting.com.br (PROD)                            │
│         dev.ekip.viaconsulting.com.br (DEV)                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────┐          ┌────────────────────────┐
│      CloudFront       │          │    AWS App Runner      │
│      + S3 Bucket      │          │    (Backend API)       │
│      (Frontend)       │          │    Node.js 20          │
│      React SPA        │          │    Auto-scaling        │
│                       │          │    WebSocket ✓         │
└───────────────────────┘          └───────────┬────────────┘
                                               │
                                               ▼
                                   ┌────────────────────────┐
                                   │       Supabase         │
                                   │   (Banco + Auth +      │
                                   │    Realtime + RLS)     │
                                   │                        │
                                   │   PROD: projeto atual  │
                                   │   DEV: novo projeto    │
                                   └────────────────────────┘
```

### Fluxo de Requisições

1. **Frontend**: Usuário acessa `ekip.viaconsulting.com.br`
2. **DNS**: Route 53 resolve para CloudFront
3. **CDN**: CloudFront serve arquivos estáticos do S3
4. **API**: Chamadas `/api/*` vão para App Runner
5. **Backend**: Express processa e consulta Supabase
6. **WebSocket**: Socket.IO conecta via App Runner (suporta WS)

---

## Pré-requisitos

### Contas e Acessos

- [ ] Conta AWS com permissões de administrador
- [ ] Conta GitHub com acesso ao repositório `alexandreribeirovia/EKIP`
- [ ] Conta Supabase com acesso ao projeto atual (PROD)
- [ ] Domínio registrado (ex: `viaconsulting.com.br`)

### Ferramentas Locais

```bash
# AWS CLI
winget install Amazon.AWSCLI
aws configure

# Node.js 20+
winget install OpenJS.NodeJS.LTS

# Git
winget install Git.Git
```

### Gerar Chaves de Criptografia

```bash
# ENCRYPTION_KEY (64 caracteres hexadecimais)
openssl rand -hex 32
# Exemplo: a1b2c3d4e5f6...

# Ou via Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Checklist Completo

### Fase 0: Pré-requisitos
- [ ] Conta AWS criada e configurada
- [ ] AWS CLI instalado e configurado (`aws configure`)
- [ ] Acesso admin ao repositório GitHub `alexandreribeirovia/EKIP`
- [ ] Acesso admin ao projeto Supabase atual (PROD)
- [ ] Domínio disponível (ex: `viaconsulting.com.br`)
- [ ] Gerar `ENCRYPTION_KEY`: executar `openssl rand -hex 32`

---

### Fase 1: Supabase DEV
- [ ] **1.1** Acessar [supabase.com](https://supabase.com) e fazer login
- [ ] **1.2** Criar novo projeto "EKIP-DEV"
  - [ ] Escolher região: South America (São Paulo)
  - [ ] Definir senha do banco
  - [ ] Aguardar provisionamento (~2 min)
- [ ] **1.3** Exportar schema do PROD
  - [ ] Ir em SQL Editor no projeto PROD
  - [ ] Executar query de export ou usar Supabase CLI
  - [ ] Salvar SQL gerado
- [ ] **1.4** Importar schema no DEV
  - [ ] Ir em SQL Editor no projeto DEV
  - [ ] Colar e executar SQL do schema
- [ ] **1.5** Copiar RLS Policies
  - [ ] No PROD: Authentication → Policies → Exportar
  - [ ] No DEV: Aplicar mesmas policies
- [ ] **1.6** Criar Storage Bucket
  - [ ] Ir em Storage no projeto DEV
  - [ ] Criar bucket `ProjectProgress`
  - [ ] Configurar mesmas policies de acesso
- [ ] **1.7** Anotar credenciais DEV
  - [ ] `SUPABASE_URL`: ____________________
  - [ ] `SUPABASE_ANON_KEY`: ____________________
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`: ____________________
- [ ] **1.8** Configurar Auth URLs (após ter domínios)
  - [ ] Site URL: `https://dev.ekip.viaconsulting.com.br`
  - [ ] Redirect URLs: adicionar domínio DEV

---

### Fase 2: AWS - Configuração Inicial
- [ ] **2.1** Criar usuário IAM para CI/CD
  - [ ] IAM → Users → Create User: `ekip-deploy`
  - [ ] Attach policies: `AmazonS3FullAccess`, `CloudFrontFullAccess`, `AWSAppRunnerFullAccess`
  - [ ] Criar Access Key e anotar:
    - [ ] `AWS_ACCESS_KEY_ID`: ____________________
    - [ ] `AWS_SECRET_ACCESS_KEY`: ____________________
- [ ] **2.2** Escolher região principal: `sa-east-1` (São Paulo)

---

### Fase 3: Frontend PROD (S3 + CloudFront)
- [ ] **3.1** Criar Bucket S3
  - [ ] S3 → Create Bucket
  - [ ] Nome: `ekip-frontend-prod`
  - [ ] Região: `sa-east-1`
  - [ ] Block all public access: ✅ ON
  - [ ] Versioning: Desabilitado (opcional)
- [ ] **3.2** Criar Distribuição CloudFront
  - [ ] CloudFront → Create Distribution
  - [ ] Origin domain: selecionar bucket `ekip-frontend-prod`
  - [ ] Origin access: **Origin Access Control (OAC)**
  - [ ] Criar novo OAC: `ekip-frontend-oac`
  - [ ] Default root object: `index.html`
  - [ ] Viewer protocol policy: **Redirect HTTP to HTTPS**
  - [ ] Cache policy: `CachingOptimized`
  - [ ] Price class: `Use only North America and Europe` (mais barato)
- [ ] **3.3** Configurar Bucket Policy (após criar distribuição)
  - [ ] Copiar policy gerada pelo CloudFront
  - [ ] S3 → Bucket → Permissions → Bucket Policy → Colar
- [ ] **3.4** Configurar Error Pages (SPA Routing)
  - [ ] CloudFront → Distribution → Error Pages
  - [ ] Criar custom error response:
    - [ ] Error code: `403` → Response: `/index.html` → HTTP 200
    - [ ] Error code: `404` → Response: `/index.html` → HTTP 200
- [ ] **3.5** Anotar Distribution ID: ____________________
- [ ] **3.6** Anotar Domain Name: `d1234abcd.cloudfront.net`

---

### Fase 4: Frontend DEV (S3 + CloudFront)
- [ ] **4.1** Repetir passos 3.1 a 3.6 com:
  - [ ] Bucket: `ekip-frontend-dev`
  - [ ] Anotar Distribution ID DEV: ____________________
  - [ ] Anotar Domain Name DEV: ____________________

---

### Fase 5: Backend PROD (App Runner)
- [ ] **5.1** Conectar GitHub ao App Runner
  - [ ] App Runner → Create Service
  - [ ] Source: **Source code repository**
  - [ ] Conectar conta GitHub
  - [ ] Selecionar repo: `alexandreribeirovia/EKIP`
  - [ ] Branch: `main`
- [ ] **5.2** Configurar Build
  - [ ] Configuration: **Configure all settings here**
  - [ ] Runtime: `Nodejs 20`
  - [ ] Build command: `cd backend && npm ci && npm run build`
  - [ ] Start command: `cd backend && npm start`
  - [ ] Port: `5000`
- [ ] **5.3** Configurar Service
  - [ ] Service name: `ekip-backend-prod`
  - [ ] CPU: `0.25 vCPU`
  - [ ] Memory: `0.5 GB`
  - [ ] Auto scaling: Min 1, Max 3
- [ ] **5.4** Configurar Health Check
  - [ ] Protocol: `HTTP`
  - [ ] Path: `/health`
  - [ ] Interval: `10 seconds`
- [ ] **5.5** Adicionar Environment Variables
  - [ ] `NODE_ENV`: `production`
  - [ ] `PORT`: `5000`
  - [ ] `SUPABASE_URL`: (valor PROD)
  - [ ] `SUPABASE_ANON_KEY`: (valor PROD)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`: (valor PROD)
  - [ ] `ENCRYPTION_KEY`: (64 chars hex gerado)
  - [ ] `FRONTEND_URL`: `https://ekip.viaconsulting.com.br`
- [ ] **5.6** Criar Service e aguardar deploy (~5 min)
- [ ] **5.7** Testar endpoint: `https://<app-runner-url>/health`
- [ ] **5.8** Anotar URL App Runner PROD: ____________________

---

### Fase 6: Backend DEV (App Runner)
- [ ] **6.1** Repetir passos 5.1 a 5.8 com:
  - [ ] Branch: `develop`
  - [ ] Service name: `ekip-backend-dev`
  - [ ] Variáveis com valores DEV (Supabase DEV)
  - [ ] `FRONTEND_URL`: `https://dev.ekip.viaconsulting.com.br`
- [ ] **6.2** Anotar URL App Runner DEV: ____________________

---

### Fase 7: Domínio e SSL
- [ ] **7.1** Criar Certificado SSL (ACM)
  - [ ] ⚠️ **IMPORTANTE**: Região `us-east-1` (N. Virginia) para CloudFront
  - [ ] ACM → Request Certificate → Public
  - [ ] Domain names:
    - [ ] `ekip.viaconsulting.com.br`
    - [ ] `dev.ekip.viaconsulting.com.br`
    - [ ] `api.ekip.viaconsulting.com.br`
    - [ ] `api-dev.ekip.viaconsulting.com.br`
  - [ ] Validation: DNS
- [ ] **7.2** Validar Certificado
  - [ ] Criar registros CNAME no Route 53 (ou DNS atual)
  - [ ] Aguardar status: `Issued` (~5-30 min)
- [ ] **7.3** Criar Hosted Zone (se não existir)
  - [ ] Route 53 → Create Hosted Zone
  - [ ] Domain: `viaconsulting.com.br`
  - [ ] Atualizar NS records no registrador do domínio
- [ ] **7.4** Configurar Custom Domain no CloudFront PROD
  - [ ] CloudFront → Distribution PROD → Edit
  - [ ] Alternate domain name (CNAME): `ekip.viaconsulting.com.br`
  - [ ] Custom SSL certificate: selecionar certificado criado
- [ ] **7.5** Configurar Custom Domain no CloudFront DEV
  - [ ] CNAME: `dev.ekip.viaconsulting.com.br`
- [ ] **7.6** Configurar Custom Domain no App Runner PROD
  - [ ] App Runner → Service PROD → Custom domains
  - [ ] Add: `api.ekip.viaconsulting.com.br`
  - [ ] Criar registros DNS conforme instruído
- [ ] **7.7** Configurar Custom Domain no App Runner DEV
  - [ ] Add: `api-dev.ekip.viaconsulting.com.br`
- [ ] **7.8** Criar registros DNS no Route 53
  - [ ] `ekip` → CNAME → CloudFront PROD domain
  - [ ] `dev.ekip` → CNAME → CloudFront DEV domain
  - [ ] `api.ekip` → CNAME → App Runner PROD domain
  - [ ] `api-dev.ekip` → CNAME → App Runner DEV domain

---

### Fase 8: CI/CD (GitHub Actions)
- [ ] **8.1** Adicionar Secrets no GitHub
  - [ ] Repo → Settings → Secrets and variables → Actions
  - [ ] **Secrets para PROD**:
    - [ ] `AWS_ACCESS_KEY_ID`
    - [ ] `AWS_SECRET_ACCESS_KEY`
    - [ ] `PROD_CF_DISTRIBUTION_ID`
    - [ ] `PROD_API_URL`: `https://api.ekip.viaconsulting.com.br`
    - [ ] `PROD_SUPABASE_URL`
    - [ ] `PROD_SUPABASE_ANON_KEY`
  - [ ] **Secrets para DEV**:
    - [ ] `DEV_CF_DISTRIBUTION_ID`
    - [ ] `DEV_API_URL`: `https://api-dev.ekip.viaconsulting.com.br`
    - [ ] `DEV_SUPABASE_URL`
    - [ ] `DEV_SUPABASE_ANON_KEY`
- [ ] **8.2** Criar arquivo `.github/workflows/deploy-prod.yml`
- [ ] **8.3** Criar arquivo `.github/workflows/deploy-dev.yml`
- [ ] **8.4** Testar workflow com push de teste

---

### Fase 9: Atualizar Configurações Finais
- [ ] **9.1** Atualizar Supabase PROD
  - [ ] Authentication → URL Configuration
  - [ ] Site URL: `https://ekip.viaconsulting.com.br`
  - [ ] Redirect URLs: adicionar domínio PROD
- [ ] **9.2** Atualizar Supabase DEV
  - [ ] Site URL: `https://dev.ekip.viaconsulting.com.br`
  - [ ] Redirect URLs: adicionar domínio DEV
- [ ] **9.3** Fazer primeiro deploy manual
  - [ ] Build frontend local com variáveis PROD
  - [ ] Upload para S3: `aws s3 sync dist/ s3://ekip-frontend-prod --delete`
  - [ ] Invalidar cache: `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"`

---

### Fase 10: Validação Final
- [ ] **10.1** Testar Frontend PROD
  - [ ] Acessar `https://ekip.viaconsulting.com.br`
  - [ ] Verificar carregamento da página
  - [ ] Verificar rotas SPA (refresh em /employees funciona)
- [ ] **10.2** Testar Backend PROD
  - [ ] Acessar `https://api.ekip.viaconsulting.com.br/health`
  - [ ] Deve retornar: `{ "status": "ok" }`
- [ ] **10.3** Testar Login PROD
  - [ ] Fazer login com usuário existente
  - [ ] Verificar se dados carregam corretamente
- [ ] **10.4** Testar WebSocket PROD
  - [ ] Verificar notificações em tempo real
- [ ] **10.5** Repetir testes 10.1-10.4 para ambiente DEV
- [ ] **10.6** Testar CI/CD
  - [ ] Fazer pequena alteração no frontend
  - [ ] Push para `main`
  - [ ] Verificar se deploy automático funciona

---

### Fase 11: Documentação e Backup
- [ ] **11.1** Documentar URLs finais
  - [ ] Frontend PROD: ____________________
  - [ ] Frontend DEV: ____________________
  - [ ] API PROD: ____________________
  - [ ] API DEV: ____________________
- [ ] **11.2** Salvar credenciais em local seguro (1Password, Vault, etc.)
- [ ] **11.3** Configurar backup Supabase PROD (opcional mas recomendado)
  - [ ] Supabase Dashboard → Database → Backups
  - [ ] Ativar Point-in-Time Recovery (plano Pro)
- [ ] **11.4** Configurar alertas CloudWatch (opcional)
  - [ ] Alarme para erros 5xx no App Runner
  - [ ] Alarme para uso de CPU > 80%

---

## Detalhamento por Fase

### Supabase - Exportar Schema

Para exportar o schema completo do banco PROD:

```sql
-- No SQL Editor do Supabase PROD, execute:

-- 1. Listar todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 2. Para cada tabela, gerar CREATE TABLE
-- Use o Supabase CLI ou pg_dump para export completo
```

**Via Supabase CLI** (recomendado):

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Linkar projeto PROD
supabase link --project-ref <project-id>

# Exportar schema
supabase db dump --schema public > schema.sql

# No projeto DEV, importar
supabase db push
```

### S3 Bucket Policy

Após criar a distribuição CloudFront, copie esta policy para o bucket S3:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::ekip-frontend-prod/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
                }
            }
        }
    ]
}
```

### App Runner - apprunner.yaml (Opcional)

Você pode criar um arquivo `apprunner.yaml` na raiz do projeto para configuração declarativa:

```yaml
version: 1.0
runtime: nodejs20
build:
  commands:
    build:
      - cd backend && npm ci && npm run build
run:
  command: cd backend && npm start
  network:
    port: 5000
    env: PORT
  env:
    - name: NODE_ENV
      value: "production"
```

---

## Variáveis de Ambiente

### Backend (Produção)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NODE_ENV` | ✅ | `production` |
| `PORT` | ✅ | `5000` |
| `SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | ✅ | Chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Chave de serviço (bypass RLS) |
| `ENCRYPTION_KEY` | ✅ | 64 caracteres hex para AES-256-GCM |
| `FRONTEND_URL` | ✅ | URL do frontend (CORS) |
| `JWT_SECRET` | ⚠️ | Legacy, manter para compatibilidade |

### Frontend (Build Time)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_API_URL` | ✅ | URL completa da API (com `/api`) |
| `VITE_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Chave pública (anon) |
| `VITE_TURNSTILE_SITE_KEY` | ❌ | Cloudflare CAPTCHA (opcional) |

### Exemplo .env.production (Backend)

```env
NODE_ENV=production
PORT=5000
SUPABASE_URL=https://abcdefghij.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
FRONTEND_URL=https://ekip.viaconsulting.com.br
```

---

## CI/CD com GitHub Actions

### Workflow: Deploy Produção

Criar arquivo `.github/workflows/deploy-prod.yml`:

```yaml
name: Deploy Production

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
      - 'backend/**'

env:
  AWS_REGION: sa-east-1

jobs:
  deploy-frontend:
    name: Deploy Frontend to S3/CloudFront
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.modified, 'frontend/') || contains(github.event.head_commit.added, 'frontend/')
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install Dependencies
        working-directory: frontend
        run: npm ci

      - name: Build
        working-directory: frontend
        env:
          VITE_API_URL: ${{ secrets.PROD_API_URL }}
          VITE_SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.PROD_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Sync to S3
        run: |
          aws s3 sync frontend/dist s3://ekip-frontend-prod \
            --delete \
            --cache-control "public, max-age=31536000" \
            --exclude "index.html"
          
          aws s3 cp frontend/dist/index.html s3://ekip-frontend-prod/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.PROD_CF_DISTRIBUTION_ID }} \
            --paths "/*"

  # Backend é deployado automaticamente pelo App Runner
  # ao detectar push na branch main
```

### Workflow: Deploy Desenvolvimento

Criar arquivo `.github/workflows/deploy-dev.yml`:

```yaml
name: Deploy Development

on:
  push:
    branches: [develop]
    paths:
      - 'frontend/**'
      - 'backend/**'

env:
  AWS_REGION: sa-east-1

jobs:
  deploy-frontend:
    name: Deploy Frontend to S3/CloudFront (DEV)
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install Dependencies
        working-directory: frontend
        run: npm ci

      - name: Build
        working-directory: frontend
        env:
          VITE_API_URL: ${{ secrets.DEV_API_URL }}
          VITE_SUPABASE_URL: ${{ secrets.DEV_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.DEV_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Sync to S3
        run: |
          aws s3 sync frontend/dist s3://ekip-frontend-dev \
            --delete \
            --cache-control "public, max-age=31536000" \
            --exclude "index.html"
          
          aws s3 cp frontend/dist/index.html s3://ekip-frontend-dev/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.DEV_CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

### Workflow: Pull Request Check

Criar arquivo `.github/workflows/pr-check.yml`:

```yaml
name: PR Check

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-build:
    name: Lint and Build Check
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Frontend Dependencies
        working-directory: frontend
        run: npm ci

      - name: Lint Frontend
        working-directory: frontend
        run: npm run lint || true

      - name: Build Frontend
        working-directory: frontend
        env:
          VITE_API_URL: https://api.example.com
          VITE_SUPABASE_URL: https://example.supabase.co
          VITE_SUPABASE_ANON_KEY: dummy-key
        run: npm run build

      - name: Install Backend Dependencies
        working-directory: backend
        run: npm ci

      - name: Build Backend
        working-directory: backend
        run: npm run build
```

---

## Troubleshooting

### Frontend não carrega após deploy

1. **Verificar S3**: Confirmar que arquivos estão no bucket
   ```bash
   aws s3 ls s3://ekip-frontend-prod/
   ```

2. **Verificar CloudFront**: Checar se distribuição está `Deployed`

3. **Invalidar cache**:
   ```bash
   aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
   ```

4. **Verificar Error Pages**: SPA precisa de 403/404 → `/index.html`

### Backend retorna 502/503

1. **Verificar logs App Runner**:
   - Console AWS → App Runner → Service → Logs

2. **Testar health check**:
   ```bash
   curl https://<app-runner-url>/health
   ```

3. **Verificar variáveis de ambiente**: Todas obrigatórias configuradas?

4. **Verificar Supabase**: URL e chaves corretas?

### CORS Error no Frontend

1. **Verificar FRONTEND_URL** no backend:
   - Deve ser exatamente a URL do frontend (com https://)
   - Sem barra final

2. **Verificar se API URL está correta** no frontend:
   - `VITE_API_URL` deve apontar para o backend

### WebSocket não conecta

1. **App Runner suporta WebSocket**: Verificar se está usando HTTPS

2. **Verificar CORS**: `credentials: true` no Socket.IO

3. **Verificar timeout**: Aumentar `pingTimeout` se necessário

### Supabase RLS blocking requests

1. **Verificar policies**: Tabelas sem policy retornam vazio

2. **Usar Service Role Key** para operações administrativas

3. **Debug no Supabase Dashboard**: SQL Editor → testar queries

---

## Custos Estimados

### Mensal (USD)

| Serviço | PROD | DEV | Observações |
|---------|------|-----|-------------|
| **App Runner** | $5-15 | $5 | 0.25 vCPU / 0.5 GB, auto-scale |
| **S3** | $0.50 | $0.50 | ~100 MB de assets |
| **CloudFront** | $1-5 | $1 | ~10 GB transfer/mês |
| **Route 53** | $0.50 | — | Por hosted zone |
| **ACM** | $0 | — | Certificados gratuitos |
| **CloudWatch** | $1-3 | — | Logs básicos |
| **Supabase** | $0-25 | $0 | Free tier ou Pro |
| **Total** | **~$8-50** | **~$7** | **~$15-60/mês** |

### Free Tier (12 meses)

- S3: 5 GB storage, 20K GET, 2K PUT
- CloudFront: 1 TB transfer, 10M requests
- App Runner: 1M requests/mês gratuitos

### Supabase Free Tier Limits

- 500 MB database
- 1 GB file storage
- 2 GB bandwidth
- 50K MAU (Monthly Active Users)

---

## Referências

- [AWS App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [CloudFront + S3 Static Hosting](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## Histórico de Atualizações

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-02 | 1.0 | Versão inicial |
