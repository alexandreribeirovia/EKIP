# EKIP - Enterprise Knowledge for Implementation Projects

<p align="center">
  <img src="frontend/img/logo-ekip.png" alt="EKIP Logo" width="200"/>
</p>

EKIP é um portal de gestão para alocação de consultores, projetado para otimizar o monitoramento e a atribuição de profissionais em projetos de implementação.

## 🚀 Arquitetura e Tecnologias

O EKIP utiliza uma arquitetura full-stack com TypeScript e **Supabase** como plataforma de banco de dados e autenticação.

### Frontend
- **Framework**: React 18 + Vite 7
- **Linguagem**: TypeScript 5.3
- **Estilização**: Tailwind CSS 3.3 (com suporte a dark mode nativo)
- **Tabelas e Gráficos**:
  - AG-Grid 31 para tabelas de dados complexas e interativas
  - Recharts 2.15 para visualização de dados e dashboards
  - FullCalendar 6 para cronogramas e visualização de alocações (Gantt)
- **UI/UX**:
  - Lucide React para ícones
  - React Select para campos de seleção avançados
  - React Quill para edição WYSIWYG de textos
  - Tippy.js para tooltips interativos
  - DnD Kit para funcionalidades de drag-and-drop
  - Canvas Confetti para animações de celebração
- **Roteamento**: React Router v6
- **Gerenciamento de Estado**:
  - Zustand (com `persist` middleware) para autenticação, notificações e permissões
  - React Hook Form para gerenciamento de formulários
- **Comunicação em Tempo Real**: Socket.IO Client para notificações
- **Segurança**: Cloudflare Turnstile (CAPTCHA) na tela de login

### Backend
- **Framework**: Node.js + Express 4.18
- **Linguagem**: TypeScript 5.3
- **Banco de Dados**: PostgreSQL gerenciado pelo **Supabase**
  - `supabaseAdmin` (Service Role) para operações no backend (bypass RLS)
  - Supabase client no frontend para funcionalidades específicas
- **Autenticação**: Supabase Auth com sessões server-side (cookies httpOnly)
  - Session store criptografado no backend
  - Refresh automático de sessão via middleware `sessionAuth`
- **Segurança**:
  - Helmet para headers HTTP seguros
  - Express Rate Limit e Slow Down para proteção contra ataques
  - Zod e Express Validator para validação de schemas
  - Criptografia de sessões com chave AES-256
  - Cloudflare Turnstile (CAPTCHA) para proteção contra bots
- **Documentação da API**: Swagger (OpenAPI) gerado automaticamente
- **Comunicação em Tempo Real**: Socket.IO + Supabase Realtime para notificações push

### Supabase Edge Functions
- Importação de dados do RunRun.it (projetos, tarefas, clientes, funcionários, horas)
- Importação de progresso de projetos via CSV
- Importação de folgas e feriados

## 📁 Estrutura do Projeto

```
EKIP/
├── frontend/              # Aplicação React (Vite)
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis (modais, renderers, toasts)
│   │   ├── pages/         # Páginas/rotas da aplicação
│   │   ├── stores/        # Zustand stores (auth, notifications, permissions)
│   │   ├── lib/           # Utilitários e clientes (apiClient, Supabase)
│   │   ├── constants/     # Constantes (permissões)
│   │   └── types.ts       # Tipos TypeScript do frontend
│   └── img/               # Assets estáticos
├── backend/               # API Node.js (Express + Supabase)
│   └── src/
│       ├── routes/        # Rotas da API REST
│       ├── middleware/     # Middlewares (sessionAuth, checkPermission, errors)
│       ├── lib/           # Utilitários (encryption, sessionStore, supabaseAdmin)
│       └── websocket/     # Socket.IO para notificações em tempo real
├── shared/                # Tipos e interfaces compartilhados
│   └── types/
├── supabase/              # Supabase Edge Functions
│   └── Edge Functions/    # Funções serverless (importações RunRun.it, CSV, etc.)
├── docs/                  # Documentação funcional e técnica
│   ├── employees/         # Docs do módulo de funcionários
│   ├── projects/          # Docs do módulo de projetos
│   ├── login/             # Docs do fluxo de autenticação
│   ├── project-detail/    # Docs da página de detalhes do projeto
│   └── roles-management/  # Docs de gestão de perfis de acesso
├── template/              # Templates de email (convite, reset de senha)
│   └── email/
└── package.json           # Scripts de orquestração (dev, build, install)
```

## 🛠️ Instalação e Execução

### Pré-requisitos
- Node.js 20+ (versão LTS recomendada)
- Conta no [Supabase](https://supabase.com) com projeto configurado

### Desenvolvimento Local

1. **Clone o repositório**
   ```bash
   git clone https://github.com/alexandreribeirovia/EKIP.git
   cd EKIP
   ```

2. **Instale as dependências** (isso instalará para a raiz, frontend e backend)
   ```bash
   npm run install:all
   ```

3. **Configure as variáveis de ambiente**
   - Copie `backend/env.example` para `backend/.env`
   - Copie `frontend/env.example` para `frontend/.env`
   - Preencha as variáveis necessárias:

   **Backend (`backend/.env`)**:
   | Variável | Descrição |
   |----------|-----------|
   | `DATABASE_URL` | String de conexão do PostgreSQL |
   | `SUPABASE_URL` | URL do projeto Supabase |
   | `SUPABASE_ANON_KEY` | Chave anônima do Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Chave Service Role do Supabase |
   | `ENCRYPTION_KEY` | Chave AES-256 para criptografia de sessões |
   | `FRONTEND_URL` | URL do frontend (default: `http://localhost:3000`) |

   **Frontend (`frontend/.env`)**:
   | Variável | Descrição |
   |----------|-----------|
   | `VITE_API_URL` | URL da API backend (default: `http://localhost:5000/api`) |
   | `VITE_SUPABASE_URL` | URL do projeto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase |
   | `VITE_TURNSTILE_SITE_KEY` | Chave do Cloudflare Turnstile (CAPTCHA) |

4. **Inicie os servidores de desenvolvimento**
   ```bash
   npm run dev
   ```

   > No Windows, também é possível usar o script de instalação: `.\install-windows.ps1`

### Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia frontend e backend simultaneamente |
| `npm run dev:frontend` | Inicia apenas o frontend (porta 3000) |
| `npm run dev:backend` | Inicia apenas o backend (porta 5000) |
| `npm run build` | Build de produção (frontend + backend) |
| `npm run install:all` | Instala dependências em todos os projetos |
| `npm start` | Inicia o backend em modo produção |

## 🌐 URLs de Desenvolvimento

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Frontend | http://localhost:3000 | Aplicação React |
| Backend API | http://localhost:5000 | API REST Express |
| Swagger Docs | http://localhost:5000/api-docs | Documentação interativa da API |
| Health Check | http://localhost:5000/health | Verificação de saúde da API |

## 📋 Funcionalidades Principais

### 📊 Dashboard
- Visão geral das métricas da empresa com cards de utilização de alocação para a semana atual e 3 semanas futuras
- Listagem de férias em andamento e futuras para planejamento
- Indicadores de projetos e consultores ativos

### 📅 Alocações (Matriz Semanal)
- Visualização de alocações em cronograma interativo (Gantt) com FullCalendar
- Filtros avançados por consultor, projeto e habilidades
- Agrupamento de tarefas por projeto para visão consolidada
- Modo de apresentação (tela cheia) para reuniões de planejamento

### 👥 Gestão de Funcionários
- Listagem de funcionários com busca e filtros por habilidade e status
- Página de detalhes do funcionário com visão 360°:
  - **Dados Cadastrais**: Informações pessoais, gestão de habilidades e status
  - **Tarefas Atribuídas**: Histórico de tarefas com filtros avançados
  - **Registro de Horas**: Tabela detalhada de horas lançadas por mês
  - **Feedbacks**: Visualização e registro de feedbacks recebidos
  - **Avaliações**: Histórico de avaliações de desempenho
  - **PDI**: Plano de Desenvolvimento Individual com acompanhamento
  - **Acompanhamento**: Dashboard de performance com gráficos de evolução

### 📁 Gestão de Projetos
- Listagem de projetos com filtros e estatísticas
- Página de detalhes do projeto com abas:
  - **Acompanhamento**: Dashboard com resumo de horas, tarefas e status
  - **Riscos**: Matriz de riscos com planos de ação e responsáveis
  - **Relatório de Status**: Gráficos de Curva S e progresso de fases
  - **Upload de Progresso**: Interface para importação de planilhas CSV

### ⏱️ Lançamento de Horas
- Relatório detalhado de horas esperadas vs. trabalhadas
- Saldo de banco de horas e horas extras
- Visualização por período customizável

### 💬 Feedbacks
- Tela centralizada para visualizar e gerenciar todos os feedbacks
- Editor WYSIWYG para formatação rica de textos
- Fluxo de aceite de feedback pelo colaborador
- Histórico completo de feedbacks por colaborador

### 📝 Avaliações de Desempenho
- Acompanhamento de todas as avaliações realizadas
- Modelos de avaliação customizáveis com categorias e perguntas
- Rating visual com estrelas
- Fluxo de aceite de avaliação pelo colaborador

### 🎯 PDI (Plano de Desenvolvimento Individual)
- Gestão centralizada de todos os PDIs
- Acompanhamento de metas e progresso
- Vinculação com avaliações de desempenho

### 📋 Pesquisas (Quiz)
- Criação de modelos de pesquisa com perguntas customizáveis
- Geração de links únicos para participantes
- Respostas anônimas ou identificadas
- Dashboard de resultados e estatísticas

### 🔔 Notificações em Tempo Real
- Sistema de notificações push com Socket.IO + Supabase Realtime
- Bell de notificações com contador de não lidas
- Navegação direta para o contexto da notificação (deep linking com hash)
- Histórico de notificações lidas/não lidas

### ⚙️ Administração
- **Gestão de Usuários**: Controle de acesso e convites por email
- **Perfis de Acesso**: Sistema granular de permissões por funcionalidade (CRUD por módulo)
- **Modelos de Avaliação**: Templates de avaliação com categorias e perguntas customizáveis
- **Domínios**: Gestão de dados mestres e listas de seleção do sistema

### 🔐 Autenticação e Segurança
- Sistema de login seguro com Supabase Auth e sessões server-side
- Cookies httpOnly para refresh tokens (proteção contra XSS)
- Cloudflare Turnstile (CAPTCHA) na tela de login
- Proteção contra brute-force com rate limiting e slow down
- Fluxo completo de recuperação e redefinição de senha
- Controle de permissões por perfil de acesso (frontend + backend)

## 📖 Documentação

A documentação completa do projeto está disponível na pasta `docs/`:



## 🧪 Qualidade de Código

- **ESLint**: Linting para TypeScript (frontend e backend)
- **TypeScript Strict Mode**: Verificação de tipos rigorosa
- **Swagger/OpenAPI**: Documentação interativa da API em `/api-docs`

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👨‍💻 Autor

**Via Consulting** - [alexandreribeirovia](https://github.com/alexandreribeirovia)
 