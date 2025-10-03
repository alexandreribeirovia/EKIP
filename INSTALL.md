# Instalação e Configuração do TEAM

## Pré-requisitos

- **Node.js** 18+ 
- **npm** ou **yarn**
- **PostgreSQL** 15+
- **Git**

## Instalação Rápida

### 1. Clone o repositório
```bash
git clone <repository-url>
cd team-allocation-portal
```

### 2. Instale todas as dependências
```bash
npm run install:all
```

### 3. Configure as variáveis de ambiente
```bash
# Backend
cp backend/env.example backend/.env
# Edite backend/.env com suas configurações

# Frontend
cp frontend/env.example frontend/.env
# Edite frontend/.env com suas configurações
```

### 4. Configure o banco de dados
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 5. Inicie o desenvolvimento
```bash
npm run dev
```

## Instalação Detalhada

### Backend

1. **Navegue para a pasta do backend**
```bash
cd backend
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp env.example .env
```

Edite o arquivo `.env`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/team_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Server
PORT=5000
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

4. **Configure o banco de dados**
```bash
# Crie o banco de dados
createdb team_db

# Execute as migrações
npx prisma migrate dev

# Gere o cliente Prisma
npx prisma generate
```

5. **Inicie o servidor**
```bash
npm run dev
```

### Frontend

1. **Navegue para a pasta do frontend**
```bash
cd frontend
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp env.example .env
```

Edite o arquivo `.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME="EKIP - Enterprise Knowledge for Implementation Projects"
```

4. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

## Usando Docker

### Opção 1: Docker Compose (Recomendado)

1. **Clone e configure**
```bash
git clone <repository-url>
cd team-allocation-portal
```

2. **Configure as variáveis de ambiente**
```bash
cp backend/env.example backend/.env
cp frontend/env.example frontend/.env
```

3. **Inicie com Docker Compose**
```bash
docker-compose up -d
```

4. **Execute as migrações**
```bash
docker-compose exec backend npx prisma migrate dev
```

### Opção 2: Containers Individuais

1. **Backend**
```bash
cd backend
docker build -t team-backend .
docker run -p 5000:5000 team-backend
```

2. **Frontend**
```bash
cd frontend
docker build -t team-frontend .
docker run -p 3000:3000 team-frontend
```

## Configuração do Banco de Dados

### PostgreSQL Local

1. **Instale o PostgreSQL**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Windows
# Baixe do site oficial
```

2. **Crie o banco de dados**
```bash
sudo -u postgres psql
CREATE DATABASE team_db;
CREATE USER team_user WITH PASSWORD 'team_password';
GRANT ALL PRIVILEGES ON DATABASE team_db TO team_user;
\q
```

### PostgreSQL com Docker

```bash
docker run --name team-postgres \
  -e POSTGRES_DB=team_db \
  -e POSTGRES_USER=team_user \
  -e POSTGRES_PASSWORD=team_password \
  -p 5432:5432 \
  -d postgres:15-alpine
```

## Configuração de Autenticação

### JWT (Padrão)

O sistema já está configurado para usar JWT. Configure a chave secreta no `.env`:

```env
JWT_SECRET="sua-chave-secreta-muito-segura"
```

### OAuth2 (SSO Corporativo)

Para configurar OAuth2:

1. **Configure as variáveis no backend**
```env
OAUTH_CLIENT_ID="seu-client-id"
OAUTH_CLIENT_SECRET="seu-client-secret"
OAUTH_CALLBACK_URL="http://localhost:5000/api/auth/oauth/callback"
```

2. **Configure as variáveis no frontend**
```env
VITE_OAUTH_CLIENT_ID="seu-client-id"
VITE_OAUTH_REDIRECT_URI="http://localhost:3000/auth/callback"
```

## Dados Iniciais

### Criar usuário administrador

```bash
cd backend
npx prisma studio
```

Ou via script:

```bash
cd backend
npm run seed
```

## Verificação da Instalação

### 1. Backend
- Acesse: http://localhost:5000/health
- Deve retornar: `{"status":"OK"}`

### 2. API Documentation
- Acesse: http://localhost:5000/api-docs
- Deve mostrar a documentação Swagger

### 3. Frontend
- Acesse: http://localhost:3000
- Deve mostrar a tela de login

### 4. Banco de Dados
```bash
cd backend
npx prisma studio
```

## Troubleshooting

### Erro de conexão com banco
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no `.env`
- Teste a conexão: `psql -h localhost -U team_user -d team_db`

### Erro de dependências
```bash
# Limpe o cache
npm cache clean --force

# Delete node_modules e reinstale
rm -rf node_modules package-lock.json
npm install
```

### Erro de portas
- Verifique se as portas 3000 e 5000 estão livres
- Use `lsof -i :3000` para verificar

### Erro de migração
```bash
cd backend
npx prisma migrate reset
npx prisma migrate dev
```

## Desenvolvimento

### Scripts Úteis

```bash
# Desenvolvimento completo
npm run dev

# Apenas backend
npm run dev:backend

# Apenas frontend
npm run dev:frontend

# Build completo
npm run build

# Testes
npm run test

# Linting
npm run lint
```

### Estrutura de Desenvolvimento

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **API Docs**: http://localhost:5000/api-docs
- **Prisma Studio**: http://localhost:5555 (após `npx prisma studio`)

## Produção

### Build para Produção

```bash
# Build completo
npm run build

# Iniciar produção
npm start
```

### Variáveis de Produção

```env
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_SECRET="chave-super-secreta-producao"
FRONTEND_URL="https://seu-dominio.com"
```

### Deploy com Docker

```bash
# Build das imagens
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
``` 