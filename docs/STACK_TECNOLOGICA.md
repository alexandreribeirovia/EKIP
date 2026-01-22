# EKIP - Stack Tecnológica e Opções de Hospedagem

Este documento detalha todas as tecnologias utilizadas no projeto EKIP e apresenta opções de hospedagem recomendadas.

---

## 📋 Visão Geral

O EKIP é um portal de gestão de alocação de consultores com arquitetura full-stack TypeScript:

- **Frontend**: Single Page Application (SPA) com React
- **Backend**: API REST com Node.js/Express
- **Banco de Dados**: PostgreSQL (via Prisma ORM) + Supabase
- **Autenticação**: Supabase Auth com JWT tokens

---

## 🔧 Backend

### Linguagem e Runtime

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **TypeScript** | ^5.3.3 | Linguagem principal |
| **Node.js** | 18 (Alpine) | Runtime JavaScript |

### Framework e Bibliotecas Principais

| Categoria | Tecnologia | Versão | Descrição |
|-----------|------------|--------|-----------|
| **Framework Web** | Express.js | ^4.18.2 | Framework HTTP |
| **ORM** | Prisma | ^5.7.1 | Object-Relational Mapping |
| **BaaS** | Supabase | ^2.75.0 | Backend as a Service |
| **WebSocket** | Socket.IO | ^4.8.1 | Comunicação em tempo real |

### Autenticação e Segurança

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **jsonwebtoken** | ^9.0.2 | Geração e validação de JWT |
| **Passport** | ^0.7.0 | Middleware de autenticação |
| **passport-jwt** | ^4.0.1 | Estratégia JWT para Passport |
| **passport-oauth2** | ^1.7.0 | Estratégia OAuth2 |
| **bcryptjs** | ^2.4.3 | Hash de senhas |
| **Helmet** | ^7.1.0 | Headers de segurança HTTP |
| **CORS** | ^2.8.5 | Cross-Origin Resource Sharing |

### Validação e Rate Limiting

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **Zod** | ^3.22.4 | Validação de esquemas |
| **express-validator** | ^7.0.1 | Validação de requests |
| **express-rate-limit** | ^7.1.5 | Limitação de requisições |
| **express-slow-down** | ^2.0.1 | Desaceleração de requisições |

### Utilitários

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **Multer** | ^2.0.2 | Upload de arquivos |
| **compression** | ^1.7.4 | Compressão de respostas |
| **Morgan** | ^1.10.0 | Logging de requisições HTTP |
| **dotenv** | ^16.3.1 | Variáveis de ambiente |

### Documentação API

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **swagger-jsdoc** | ^6.2.8 | Geração de docs Swagger |
| **swagger-ui-express** | ^5.0.0 | Interface Swagger UI |

### Ferramentas de Desenvolvimento

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **nodemon** | ^3.0.2 | Hot reload em desenvolvimento |
| **ts-node** | ^10.9.1 | Execução de TypeScript |
| **tsconfig-paths** | ^4.2.0 | Resolução de paths TS |
| **Jest** | ^29.7.0 | Framework de testes |
| **ts-jest** | ^29.1.1 | Jest para TypeScript |
| **ESLint** | ^8.54.0 | Linter de código |

---

## 🎨 Frontend

### Linguagem e Build

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **TypeScript** | ^5.3.3 | Linguagem principal |
| **Vite** | ^7.1.11 | Build tool e dev server |

### Framework UI

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **React** | ^18.2.0 | Biblioteca de UI |
| **React DOM** | ^18.2.0 | Renderização DOM |

### Estilização

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **Tailwind CSS** | ^3.3.6 | Framework CSS utilitário |
| **PostCSS** | ^8.4.32 | Processador CSS |
| **Autoprefixer** | ^10.4.16 | Prefixos CSS automáticos |

### Componentes e UI

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **AG-Grid** | ^31.1.1 | Tabelas e grids avançados |
| **Recharts** | ^2.15.4 | Gráficos e visualizações |
| **FullCalendar** | ^6.1.18 | Calendário interativo |
| **React Quill** | ^2.0.0 | Editor WYSIWYG |
| **React Select** | ^5.10.2 | Select avançado |
| **Lucide React** | ^0.294.0 | Biblioteca de ícones |
| **Tippy.js** | ^6.3.7 | Tooltips |
| **React Hot Toast** | ^2.4.1 | Notificações toast |

### Roteamento e Estado

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **React Router DOM** | ^6.20.1 | Roteamento SPA |
| **Zustand** | ^4.4.7 | Gerenciamento de estado |
| **React Query** | ^3.39.3 | Data fetching e cache |

### Formulários e Validação

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **React Hook Form** | ^7.48.2 | Formulários performáticos |

### HTTP e WebSocket

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **Axios** | ^1.6.2 | Cliente HTTP |
| **Socket.IO Client** | ^4.8.1 | Cliente WebSocket |
| **Supabase JS** | ^2.54.0 | Cliente Supabase |

### Drag and Drop

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **@dnd-kit/core** | ^6.3.1 | Core drag and drop |
| **@dnd-kit/sortable** | ^10.0.0 | Listas ordenáveis |
| **@dnd-kit/utilities** | ^3.2.2 | Utilitários DnD |

### Utilitários

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **date-fns** | ^2.30.0 | Manipulação de datas |
| **clsx** | ^2.0.0 | Classes condicionais |

---

## 🏗️ Infraestrutura e Serviços Externos

### Banco de Dados

| Serviço | Versão | Uso |
|---------|--------|-----|
| **PostgreSQL** | 15 | Banco de dados relacional principal |
| **Redis** | 7 | Cache e sessões (opcional, via Docker) |

### Supabase (BaaS)

O projeto utiliza Supabase para:

- **Auth**: Autenticação de usuários com JWT
- **Database**: Queries diretas para features específicas
- **Realtime**: Notificações em tempo real
- **Storage**: Upload de arquivos (bucket ProjectProgress)

### Containerização

| Tecnologia | Descrição |
|------------|-----------|
| **Docker** | Containerização de aplicações |
| **Docker Compose** | Orquestração de containers |

---

## 🌐 Opções de Hospedagem

### Backend (Node.js/Express)

| Plataforma | Tipo | Free Tier | Observações |
|------------|------|-----------|-------------|
| **Railway** | PaaS | ✅ $5/mês crédito | Fácil deploy, PostgreSQL integrado, suporta Docker |
| **Render** | PaaS | ✅ 750h/mês | Deploy automático do GitHub, SSL gratuito |
| **Fly.io** | PaaS | ✅ 3 VMs gratuitas | Boa performance, suporta WebSocket, edge computing |
| **DigitalOcean App Platform** | PaaS | ❌ A partir de $5/mês | Escalável, PostgreSQL managed disponível |
| **AWS EC2/ECS** | IaaS | ✅ 12 meses free tier | Mais controle, requer mais configuração |
| **Heroku** | PaaS | ❌ A partir de $7/mês | Simples, mas pode ser caro para escalar |
| **Google Cloud Run** | Serverless | ✅ 2M req/mês | Auto-scaling, pague pelo uso |

### Frontend (React/Vite - SPA Estático)

| Plataforma | Tipo | Free Tier | Observações |
|------------|------|-----------|-------------|
| **Vercel** | CDN/Edge | ✅ Generoso | Melhor para React/Vite, deploy automático, previews |
| **Netlify** | CDN/Edge | ✅ 100GB/mês | Excelente DX, functions serverless incluídas |
| **Cloudflare Pages** | CDN/Edge | ✅ Ilimitado | Muito rápido, integração com Workers |
| **AWS S3 + CloudFront** | CDN | ✅ 12 meses | Mais controle, configuração manual necessária |
| **GitHub Pages** | CDN | ✅ Ilimitado | Simples para projetos públicos |

### Banco de Dados

| Plataforma | Tipo | Free Tier | Observações |
|------------|------|-----------|-------------|
| **Supabase** | BaaS | ✅ 500MB, 2 projetos | **Já usado no projeto** - Auth + DB + Realtime |
| **Railway PostgreSQL** | Managed DB | ✅ $5/mês crédito | Simples integração com Railway apps |
| **Neon** | Serverless PostgreSQL | ✅ 0.5GB | Auto-scaling, branching de DB |
| **PlanetScale** | MySQL Serverless | ✅ 5GB | Branching, mas requer migração para MySQL |
| **Supabase (Pro)** | BaaS | ❌ $25/mês | 8GB, backups diários, suporte prioritário |

---

## 📐 Arquiteturas Recomendadas

### Opção 1: Econômica (Free Tiers)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │     │   Render        │     │   Supabase      │
│   (Frontend)    │────▶│   (Backend)     │────▶│   (PostgreSQL)  │
│   CDN Global    │     │   Free Tier     │     │   Free Tier     │
│   Gratuito      │     │   750h/mês      │     │   500MB         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Custo Total: ~$0/mês** (com limitações)

| Componente | Plataforma | Custo |
|------------|------------|-------|
| Frontend | Vercel | Gratuito |
| Backend | Render | Gratuito (750h/mês) |
| Banco + Auth | Supabase | Gratuito (500MB) |

**Limitações:**
- Render: Spin down após 15min de inatividade (cold start de ~30s)
- Supabase: 500MB de banco, pausa após 1 semana de inatividade

---

### Opção 2: Produção Básica (~$30-50/mês)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │     │   Railway       │     │   Supabase Pro  │
│   (Frontend)    │────▶│   (Backend)     │────▶│   (PostgreSQL)  │
│   Pro $20/mês   │     │   ~$5-20/mês    │     │   $25/mês       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Custo Total: ~$30-65/mês**

| Componente | Plataforma | Custo |
|------------|------------|-------|
| Frontend | Vercel (Free ou Pro) | $0-20/mês |
| Backend | Railway | ~$5-20/mês (uso) |
| Banco + Auth | Supabase Pro | $25/mês |

**Benefícios:**
- Sem cold starts
- 8GB de banco
- Backups diários
- Suporte prioritário

---

### Opção 3: Enterprise/Alta Disponibilidade

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Cloudflare    │     │   AWS ECS       │     │   AWS RDS       │
│   Pages + CDN   │────▶│   Fargate       │────▶│   PostgreSQL    │
│                 │     │   + ALB         │     │   Multi-AZ      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │   ElastiCache   │
                        │   Redis         │
                        └─────────────────┘
```

**Custo Total: ~$150-300+/mês**

| Componente | Plataforma | Custo |
|------------|------------|-------|
| Frontend + CDN | Cloudflare | ~$20/mês |
| Backend | AWS ECS Fargate | ~$50-100/mês |
| Load Balancer | AWS ALB | ~$20/mês |
| Banco | AWS RDS Multi-AZ | ~$50-150/mês |
| Cache | ElastiCache Redis | ~$15-50/mês |

---

## ⚠️ Considerações Importantes

### WebSocket (Socket.IO)

O projeto usa Socket.IO para notificações em tempo real. Certifique-se de que a plataforma escolhida suporta:

- Conexões WebSocket persistentes
- Sticky sessions (se usar múltiplas instâncias)

**Plataformas com bom suporte:**
- ✅ Railway
- ✅ Render
- ✅ Fly.io
- ✅ DigitalOcean
- ⚠️ Vercel (apenas para frontend, não para backend WebSocket)

### Variáveis de Ambiente

Configure as seguintes variáveis em produção:

**Backend:**
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://...
JWT_SECRET=sua-chave-secreta-forte
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
FRONTEND_URL=https://seu-frontend.vercel.app
```

**Frontend:**
```env
VITE_API_URL=https://seu-backend.railway.app/api
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

### CORS

Configure CORS no backend para aceitar requisições apenas do domínio do frontend em produção.

### SSL/HTTPS

Todas as plataformas recomendadas fornecem certificados SSL gratuitos (via Let's Encrypt).

### Build Commands

**Backend (Railway/Render):**
```bash
# Build
npm run build

# Start
npm start
```

**Frontend (Vercel/Netlify):**
```bash
# Build
npm run build

# Output directory
dist/
```

---

## 📊 Comparativo Resumido

| Critério | Render + Vercel + Supabase | Railway + Vercel + Supabase | AWS Full |
|----------|---------------------------|----------------------------|----------|
| **Custo Inicial** | Gratuito | ~$5/mês | ~$100/mês |
| **Facilidade** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Escalabilidade** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Cold Start** | Sim (free tier) | Não | Não |
| **Suporte** | Comunidade | Comunidade + Docs | Enterprise |

---

## 🚀 Recomendação Final

### Para começar (MVP/Desenvolvimento):
**Vercel (Frontend) + Render (Backend) + Supabase (DB/Auth)**
- Custo: Gratuito
- Setup: 30 minutos
- Ideal para: Testes, demos, desenvolvimento

### Para produção com baixo custo:
**Vercel (Frontend) + Railway (Backend) + Supabase Pro (DB/Auth)**
- Custo: ~$30-50/mês
- Setup: 1 hora
- Ideal para: Startups, PMEs, até ~1000 usuários

### Para produção enterprise:
**Cloudflare (Frontend) + AWS ECS (Backend) + AWS RDS (DB)**
- Custo: ~$150-300/mês
- Setup: 1-2 dias
- Ideal para: Grandes empresas, alta disponibilidade, compliance

---

*Documento criado em: Janeiro 2026*
*Última atualização: Janeiro 2026*
