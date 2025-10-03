# EKIP - Enterprise Knowledge for Implementation Projects

Portal de gestão e monitoramento de alocação de consultores em projetos.

## 🚀 Tecnologias

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** com dark mode nativo
- **AG-Grid** para tabelas avançadas
- **Recharts** para gráficos e dashboards
- **React Router** para navegação
- **React Query** para gerenciamento de estado
- **React Hook Form** para formulários

### Backend
- **Node.js** + **Express**
- **TypeScript**
- **Prisma** como ORM
- **PostgreSQL** como banco de dados
- **JWT** + **OAuth2** para autenticação
- **Swagger** para documentação da API

## 📁 Estrutura do Projeto

```
team-allocation-portal/
├── frontend/                 # Aplicação React
├── backend/                  # API Node.js
├── shared/                   # Tipos e utilitários compartilhados
├── docs/                     # Documentação
└── docker/                   # Configurações Docker
```

## 🛠️ Instalação

### Windows
1. **Instale o Node.js**: https://nodejs.org/ (versão LTS)
2. **Clone o repositório**
```bash
git clone <repository-url>
cd team-allocation-portal
```
3. **Execute o script de instalação**
```powershell
.\install-windows.ps1
```
4. **Configure as variáveis de ambiente**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
5. **Configure o banco de dados**
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```
6. **Inicie o desenvolvimento**
```bash
npm run dev
```

### Linux/macOS
1. **Clone o repositório**
```bash
git clone <repository-url>
cd team-allocation-portal
```
2. **Instale as dependências**
```bash
npm run install:all
```
3. **Configure as variáveis de ambiente**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
4. **Configure o banco de dados**
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```
5. **Inicie o desenvolvimento**
```bash
npm run dev
```

### Docker (Alternativa)
```bash
docker-compose up --build
```

## 🌐 URLs de Desenvolvimento

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **API Docs**: http://localhost:5000/api-docs

## 📋 Funcionalidades

### Dashboard
- Visão geral de alocações
- Métricas de utilização
- Gráficos de performance
- Alertas e notificações

### Gestão de Funcionários
- Cadastro e edição de consultores
- Histórico de alocações
- Perfis e habilidades
- Avaliações de performance

### Matriz Semanal
- Visualização semanal de alocações
- Drag & drop para realocação
- Filtros por projeto/funcionário
- Exportação de relatórios

### Gestão de Projetos
- Cadastro de projetos
- Cronogramas e milestones
- Orçamentos e horas planejadas
- Status e progresso

### Autenticação
- Login com SSO corporativo
- Controle de acesso por roles
- Sessões seguras
- Logs de auditoria

## 🚀 Deploy

### Produção
```bash
npm run build
npm start
```

### Docker
```bash
docker-compose up -d
```

## 📝 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes. 