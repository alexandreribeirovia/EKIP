# Solução para o Problema: "npm não é reconhecido"

## 🔍 Problema Identificado

O erro `npm não é reconhecido como nome de cmdlet` indica que o **Node.js não está instalado** no seu sistema Windows.

## ✅ Soluções Disponíveis

### 1. **Solução Recomendada: Instalar Node.js**

**Passos:**
1. Acesse: https://nodejs.org/
2. Baixe a versão **LTS** (Long Term Support)
3. Execute o instalador (.msi)
4. **IMPORTANTE**: Marque a opção "Add to PATH"
5. Reinicie o PowerShell/Prompt de Comando
6. Execute: `npm run install:all`

### 2. **Solução Automatizada: Script PowerShell**

Execute o script que criei:
```powershell
.\install-windows.ps1
```

Este script:
- Verifica se o Node.js está instalado
- Instala todas as dependências automaticamente
- Configura o ambiente
- Oferece iniciar o projeto

### 3. **Solução Alternativa: Docker**

Se preferir não instalar Node.js:
```powershell
docker-compose up --build
```

## 📋 Arquivos Criados para Ajudar

1. **`INSTALACAO_WINDOWS.md`** - Guia detalhado de instalação
2. **`install-windows.ps1`** - Script automatizado
3. **`README.md`** - Atualizado com instruções específicas para Windows

## 🚀 Próximos Passos

Após resolver o problema:

1. **Configure o banco de dados:**
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

2. **Configure as variáveis de ambiente:**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. **Inicie o projeto:**
```bash
npm run dev
```

4. **Acesse:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- API Docs: http://localhost:5000/api-docs

## 🆘 Se Ainda Tiver Problemas

1. **Verifique se o Node.js foi instalado:**
```powershell
node --version
npm --version
```

2. **Execute como Administrador** se necessário

3. **Reinicie o computador** após instalar o Node.js

4. **Verifique o PATH do sistema** se o Node.js não for encontrado

## 📞 Suporte

Se precisar de mais ajuda, verifique:
- O arquivo `INSTALACAO_WINDOWS.md` para instruções detalhadas
- O script `install-windows.ps1` para instalação automatizada
- O `README.md` atualizado com instruções específicas 