# Guia de Instalação - Windows

## Problema Identificado
O erro `npm não é reconhecido` indica que o **Node.js não está instalado** no seu sistema Windows.

## Solução 1: Instalar Node.js (Recomendado)

### Passo 1: Baixar e Instalar Node.js

1. **Acesse o site oficial**: https://nodejs.org/
2. **Baixe a versão LTS** (Long Term Support) - recomendada para a maioria dos usuários
3. **Execute o instalador** baixado (arquivo .msi)
4. **Siga o assistente de instalação**:
   - Aceite os termos de licença
   - Escolha o diretório de instalação (mantenha o padrão)
   - **IMPORTANTE**: Certifique-se de que a opção "Add to PATH" esteja marcada
   - Clique em "Install"

### Passo 2: Verificar a Instalação

Abra um **novo** PowerShell ou Prompt de Comando e execute:

```powershell
node --version
npm --version
```

Você deve ver algo como:
```
v18.17.0
9.6.7
```

### Passo 3: Instalar Dependências do Projeto

Agora você pode executar o comando que estava falhando:

```powershell
npm run install:all
```

## Solução 2: Usar Docker (Alternativa)

Se preferir não instalar Node.js localmente, você pode usar Docker:

### Pré-requisitos
1. **Instalar Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. **Iniciar o Docker Desktop**

### Executar com Docker

```powershell
# Construir e iniciar todos os serviços
docker-compose up --build

# Para executar em background
docker-compose up -d --build
```

## Solução 3: Instalação Manual das Dependências

Se ainda tiver problemas, você pode instalar as dependências manualmente:

### Frontend
```powershell
cd frontend
npm install
```

### Backend
```powershell
cd backend
npm install
```

## Verificação da Instalação

Após instalar o Node.js, execute:

```powershell
# Verificar se tudo está funcionando
npm run install:all

# Iniciar o projeto
npm run dev
```

## URLs de Acesso

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **API Docs**: http://localhost:5000/api-docs

## Problemas Comuns

### 1. "npm não é reconhecido" após instalar Node.js
**Solução**: Reinicie o PowerShell/Prompt de Comando ou reinicie o computador.

### 2. Erro de permissão no Windows
**Solução**: Execute o PowerShell como Administrador.

### 3. Erro de proxy corporativo
**Solução**: Configure o npm para usar o proxy da empresa:
```powershell
npm config set proxy http://proxy.empresa.com:8080
npm config set https-proxy http://proxy.empresa.com:8080
```

## Suporte

Se ainda tiver problemas, verifique:
1. Se o Node.js foi instalado corretamente
2. Se o PATH do sistema inclui o Node.js
3. Se não há firewall ou antivírus bloqueando
4. Se você tem permissões de administrador

## Próximos Passos

Após a instalação bem-sucedida, consulte o arquivo `INSTALL.md` para instruções completas de configuração e uso do projeto. 