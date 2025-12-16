# EKIP - Enterprise Knowledge for Implementation Projects

<p align="center">
  <img src="frontend/img/logo-ekip.png" alt="EKIP Logo" width="200"/>
</p>

EKIP é um portal de gestão para alocação de consultores, projetado para otimizar o monitoramento e a atribuição de profissionais em projetos de implementação.

## 🚀 Arquitetura e Tecnologias

O EKIP utiliza uma arquitetura full-stack com TypeScript, empregando um padrão de banco de dados duplo para combinar a robustez do PostgreSQL com a flexibilidade dos serviços da Supabase.

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
- **Roteamento**: React Router v6
- **Gerenciamento de Estado**:
  - Zustand (com `persist` middleware) para estado de autenticação
  - React Hook Form para gerenciamento de formulários
- **Comunicação em Tempo Real**: Socket.IO Client para notificações

### Backend
- **Framework**: Node.js + Express 4.18
- **Linguagem**: TypeScript 5.3
- **ORM**: Prisma 5.7 para interações com o banco de dados PostgreSQL
- **Banco de Dados**:
  - **PostgreSQL**: Gerenciado pelo Prisma para as entidades principais (Projetos, Funcionários, Alocações)
  - **Supabase**: Utilizado para funcionalidades estendidas como autenticação, armazenamento e tabelas específicas (riscos, fases de projeto, etc.)
- **Autenticação**: Supabase Auth com SSR + Passport.js (JWT e OAuth2)
- **Segurança**:
  - Helmet para headers HTTP seguros
  - Express Rate Limit e Slow Down para proteção contra ataques
  - Zod para validação de schemas
- **Documentação da API**: Swagger (OpenAPI) gerado automaticamente
- **Comunicação em Tempo Real**: Socket.IO para notificações push

## 📁 Estrutura do Projeto

```
EKIP/
├── frontend/              # Aplicação React (Vite)
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis (modais, renderers, etc.)
│   │   ├── pages/         # Páginas/rotas da aplicação
│   │   ├── stores/        # Zustand stores (auth, etc.)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilitários e clientes (Supabase, Axios)
│   │   └── types.ts       # Tipos TypeScript do frontend
│   └── img/               # Assets estáticos
├── backend/               # API Node.js (Express + Prisma)
│   ├── src/
│   │   ├── routes/        # Rotas da API REST
│   │   ├── middleware/    # Middlewares (auth, error handling)
│   │   ├── lib/           # Utilitários (encryption, Supabase clients)
│   │   └── websocket/     # Socket.IO para notificações em tempo real
│   └── prisma/            # Schema e migrações do Prisma
├── shared/                # Tipos e interfaces compartilhados
│   └── types/
├── docs/                  # Documentação funcional e técnica
│   ├── employees/         # Docs do módulo de funcionários
│   ├── projects/          # Docs do módulo de projetos
│   ├── login/             # Docs do fluxo de autenticação
│   └── project-detail/    # Docs da página de detalhes do projeto
├── template/              # Templates de email
│   └── email/
└── docker-compose.yml     # Orquestração dos contêineres
```

## 🛠️ Instalação e Execução

### Pré-requisitos
- Node.js 20+ (versão LTS recomendada)
- Docker e Docker Compose (para a abordagem com contêineres)
- PostgreSQL (se executar sem Docker)

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
     - `DATABASE_URL` - String de conexão do PostgreSQL
     - `JWT_SECRET` - Chave secreta para tokens JWT
     - `VITE_API_URL` - URL da API backend
     - `VITE_SUPABASE_URL` - URL do projeto Supabase
     - `VITE_SUPABASE_ANON_KEY` - Chave anônima do Supabase

4. **Execute as migrações do banco de dados**
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Inicie os servidores de desenvolvimento**
   ```bash
   # Volte para a pasta raiz
   cd ..
   
   # Inicia frontend e backend simultaneamente
   npm run dev
   ```

### Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia frontend e backend simultaneamente |
| `npm run dev:frontend` | Inicia apenas o frontend |
| `npm run dev:backend` | Inicia apenas o backend |
| `npm run build` | Build de produção (frontend + backend) |
| `npm run install:all` | Instala dependências em todos os projetos |

### Alternativa com Docker
Para uma inicialização simplificada, use o Docker Compose:
```bash
docker-compose up --build
```

## 🌐 URLs de Desenvolvimento

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Frontend | http://localhost:3000 | Aplicação React |
| Backend API | http://localhost:5000 | API REST Express |
| Swagger Docs | http://localhost:5000/api-docs | Documentação interativa da API |
| Prisma Studio | http://localhost:5555 | GUI do banco de dados |
| Health Check | http://localhost:5000/health | Verificação de saúde da API |

> **Nota**: Para abrir o Prisma Studio, execute `npx prisma studio` na pasta `backend`

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
- Histórico completo de feedbacks por colaborador

### 📝 Avaliações de Desempenho
- Acompanhamento de todas as avaliações realizadas
- Modelos de avaliação customizáveis com categorias e perguntas
- Rating visual com estrelas

### 🎯 PDI (Plano de Desenvolvimento Individual)
- Gestão centralizada de todos os PDIs
- Acompanhamento de metas e progresso
- Vinculação com avaliações de desempenho

### 🔔 Notificações em Tempo Real
- Sistema de notificações push com Socket.IO
- Bell de notificações com contador
- Histórico de notificações lidas/não lidas

### ⚙️ Administração
- **Gestão de Usuários**: Controle de acesso com diferentes perfis (Admin, Gerente, Usuário)
- **Modelos de Avaliação**: Templates de avaliação com categorias e perguntas customizáveis
- **Domínios**: Gestão de dados mestres e listas de seleção do sistema

### 🔐 Autenticação
- Sistema de login seguro com Supabase Auth
- Fluxo completo de recuperação e redefinição de senha
- Rotas protegidas para garantir acesso seguro
- Suporte a OAuth2 para integração com provedores externos

## 📖 Documentação

A documentação completa do projeto está disponível na pasta `docs/`:

| Documento | Descrição |
|-----------|-----------|
| [API.md](docs/API.md) | Documentação da API REST |
| [ARCHITECTURE_API_SUPABASE.md](docs/ARCHITECTURE_API_SUPABASE.md) | Arquitetura do padrão dual-database |
| [FRONTEND.md](docs/FRONTEND.md) | Guia de desenvolvimento frontend |
| [QODANA_GUIDE.md](docs/QODANA_GUIDE.md) | Guia de análise de código com Qodana |

## 🧪 Qualidade de Código

O projeto utiliza ferramentas de análise estática para manter a qualidade:

- **ESLint**: Linting para TypeScript
- **Qodana**: Análise de código estático (JetBrains)
- **TypeScript Strict Mode**: Verificação de tipos rigorosa

Para executar a análise Qodana localmente:
```powershell
.\run-qodana.ps1
```

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
 