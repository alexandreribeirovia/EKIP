# EKIP - Enterprise Knowledge for Implementation Projects

EKIP é um portal de gestão para alocação de consultores, projetado para otimizar o monitoramento e a atribuição de profissionais em projetos de implementação.

## 🚀 Arquitetura e Tecnologias

O EKIP utiliza uma arquitetura full-stack com TypeScript, empregando um padrão de banco de dados duplo para combinar a robustez do PostgreSQL com a flexibilidade dos serviços da Supabase.

### Frontend
- **Framework**: React 18 + Vite
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS (com suporte a dark mode)
- **Tabelas e Gráficos**:
  - AG-Grid para tabelas de dados complexas e interativas.
  - Recharts para visualização de dados e dashboards.
- **Roteamento**: React Router v6
- **Gerenciamento de Estado**:
  - Zustand (com `persist` middleware) para o estado de autenticação.
  - Padrão de `useState` e `useEffect` para o estado local dos componentes.

### Backend
- **Framework**: Node.js + Express
- **Linguagem**: TypeScript
- **ORM**: Prisma para interações com o banco de dados PostgreSQL.
- **Banco de Dados**:
  - **PostgreSQL**: Gerenciado pelo Prisma para as entidades principais (Projetos, Funcionários, Alocações).
  - **Supabase**: Utilizado para funcionalidades estendidas como autenticação, armazenamento e tabelas específicas (riscos, fases de projeto, etc.).
- **Autenticação**: Supabase Auth (gerenciamento de usuários e JWT).
- **Documentação da API**: Swagger (OpenAPI) gerado automaticamente.

## 📁 Estrutura do Projeto

```
EKIP/
├── frontend/         # Aplicação React (Vite)
├── backend/          # API Node.js (Express + Prisma)
├── shared/           # Tipos e interfaces compartilhados
├── docs/             # Documentação funcional e técnica
└── docker-compose.yml # Orquestração dos contêineres
```

## 🛠️ Instalação e Execução

### Pré-requisitos
- Node.js (versão LTS)
- Docker e Docker Compose (para a abordagem com contêineres)

### Desenvolvimento Local
1.  **Clone o repositório**
    ```bash
    git clone <repository-url>
    cd EKIP
    ```
2.  **Instale as dependências** (isso instalará para a raiz, frontend e backend)
    ```bash
    npm install
    ```
3.  **Configure as variáveis de ambiente**
    - Copie `backend/env.example` para `backend/.env`
    - Copie `frontend/env.example` para `frontend/.env`
    - Preencha as variáveis necessárias, como `DATABASE_URL` e as chaves da Supabase.

4.  **Execute as migrações do banco de dados**
    ```bash
    cd backend
    npx prisma migrate dev
    npx prisma generate
    ```
5.  **Inicie os servidores de desenvolvimento**
    - Volte para a pasta raiz (`cd ..`)
    - O comando a seguir iniciará o frontend e o backend simultaneamente.
    ```bash
    npm run dev
    ```

### Alternativa com Docker
Para uma inicialização simplificada, use o Docker Compose:
```bash
docker-compose up --build
```

## 🌐 URLs de Desenvolvimento

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **Documentação da API (Swagger)**: http://localhost:5000/api-docs
- **Prisma Studio (GUI do Banco)**: http://localhost:5555 (execute `npx prisma studio` na pasta `backend`)

## 📋 Funcionalidades Principais

### Dashboard
- Visão geral das métricas da empresa com cards de utilização de alocação para a semana atual e 3 semanas futuras.
- Listagem de férias em andamento e futuras para planejamento.
- Indicadores de projetos e consultores ativos.

### Alocações (Matriz Semanal)
- Visualização de alocações em um cronograma interativo (Gantt) com o FullCalendar.
- Filtros avançados por consultor, projeto e habilidades para encontrar a pessoa certa.
- Agrupamento de tarefas por projeto para uma visão consolidada.
- Modo de apresentação (tela cheia) para reuniões de planejamento.

### Gestão de Funcionários
- Listagem de funcionários com busca e filtros por habilidade e status.
- Página de detalhes do funcionário com visão 360°:
  - Dados cadastrais, gestão de habilidades e status (ativo/inativo, lança horas).
  - **Tarefas Atribuídas**: Histórico de tarefas com filtros.
  - **Registro de Horas**: Tabela detalhada de horas lançadas por mês.
  - **Feedbacks, Avaliações e PDI**: Gestão completa do ciclo de desenvolvimento do colaborador.
  - **Acompanhamento**: Dashboard de performance com gráficos de evolução, feedbacks e horas por cliente.

### Gestão de Projetos
- Listagem de projetos com filtros e estatísticas.
- Página de detalhes do projeto com abas para:
  - **Acompanhamento**: Dashboard com resumo de horas, tarefas e status.
  - **Riscos**: Matriz de riscos com planos de ação e responsáveis.
  - **Relatório de Status**: Gráficos de Curva S e progresso de fases.
  - **Upload de Progresso**: Interface para importação de planilhas CSV.

### Relatórios e Gestão
- **Lançamento de Horas**: Relatório detalhado de horas esperadas vs. trabalhadas, com saldo de banco de horas e horas extras.
- **Feedbacks**: Tela centralizada para visualizar e gerenciar todos os feedbacks.
- **Avaliações**: Acompanhamento de todas as avaliações de desempenho realizadas.
- **PDI**: Gestão centralizada de todos os Planos de Desenvolvimento Individuais.

### Administração
- **Gestão de Usuários**: Controle de acesso à plataforma com diferentes perfis (Admin, Gerente, Usuário).
- **Modelos de Avaliação**: Ferramenta para criar e gerenciar os templates de avaliação de desempenho, com categorias e perguntas customizáveis.
- **Domínios**: Gestão de dados mestres e listas de seleção do sistema (ex: status, tipos de risco, etc.).

### Autenticação
- Sistema de login seguro com Supabase Auth.
- Fluxo completo de recuperação e redefinição de senha.
- Rotas protegidas para garantir o acesso seguro às informações.
 