# Guia de Autenticação com Supabase Auth

## Visão Geral

O sistema EKIP agora utiliza **Supabase Auth** para autenticação de usuários, substituindo o sistema JWT local anterior. Esta mudança proporciona:

- ✅ **Autenticação segura** com JWT gerenciado pelo Supabase
- ✅ **Row Level Security (RLS)** automático no banco de dados
- ✅ **Refresh tokens** gerenciados automaticamente
- ✅ **Sessões persistentes** com sincronização entre abas
- ✅ **Integração simplificada** entre frontend e backend

## Arquitetura

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
│                 │
│  ┌───────────┐  │
│  │ authStore │  │  <- Zustand + Supabase Auth
│  └───────────┘  │
│        │        │
│        ▼        │
│  ┌───────────┐  │
│  │ supabase  │  │  <- Client com sessão do usuário
│  │  client   │  │
│  └───────────┘  │
└────────┬────────┘
         │
         │ JWT Token (Authorization: Bearer <token>)
         │
         ▼
┌─────────────────┐
│   Backend       │
│   (Express)     │
│                 │
│  ┌───────────┐  │
│  │supabaseAuth│ │  <- Middleware valida JWT
│  │middleware  │  │
│  └───────────┘  │
│        │        │
│        ▼        │
│  ┌───────────┐  │
│  │ Supabase  │  │  <- Client com contexto do usuário
│  │  Admin    │  │     (RLS aplicado)
│  └───────────┘  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Supabase      │
│   Database      │
│                 │
│  + RLS Policies │
└─────────────────┘
```

## Configuração

### 1. Variáveis de Ambiente

#### Frontend (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:5000
```

#### Backend (`backend/.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 2. Criar Usuários no Supabase

Os usuários devem ser criados no Supabase Auth Dashboard ou via API:

```typescript
// Exemplo: Criar usuário via Supabase Admin
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'secure_password',
  email_confirm: true,
  user_metadata: {
    name: 'Nome do Usuário',
    role: 'user', // ou 'admin'
    avatar: 'https://example.com/avatar.jpg',
    runrun_user_id: 'runrun-id-123'
  }
})
```

## Fluxo de Autenticação

### Login

#### Frontend
```typescript
// Em Login.tsx ou em qualquer lugar
import { useAuthStore } from '@/stores/authStore'

const { login } = useAuthStore()

const handleLogin = async () => {
  const result = await login(email, password)
  
  if (result.success) {
    // Usuário autenticado, redirecionar
    navigate('/dashboard')
  } else {
    // Mostrar erro
    setError(result.error)
  }
}
```

#### Backend
```typescript
// POST /api/auth/login
{
  "email": "user@example.com",
  "password": "senha123"
}

// Resposta
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Nome do Usuário",
      "role": "user",
      "avatar": "url",
      "runrun_user_id": "runrun-id"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1234567890,
      "expires_in": 3600
    }
  }
}
```

### Logout

```typescript
// Frontend
const { logout } = useAuthStore()
await logout() // Limpa sessão local e invalida no Supabase
```

### Verificar Usuário Autenticado

```typescript
// Frontend - Hook do Zustand
const { user, isAuthenticated, loading } = useAuthStore()

// Inicializar autenticação ao carregar o app
useEffect(() => {
  initializeAuth()
}, [])
```

### Fazer Chamadas Autenticadas

#### Frontend (Direto ao Supabase)
```typescript
import { supabase } from '@/lib/supabaseClient'

// O supabase client já usa a sessão autenticada automaticamente
const { data, error } = await supabase
  .from('projects_phase')
  .select('*')
  .eq('project_id', projectId)
// RLS é aplicado automaticamente!
```

#### Frontend (API Backend)
```typescript
import { useAuthStore } from '@/stores/authStore'

const { session } = useAuthStore()

const response = await fetch('/api/projects', {
  headers: {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json'
  }
})
```

## Backend - Rotas Protegidas

### Usar Middleware de Autenticação

```typescript
import { Router } from 'express'
import { supabaseAuth } from '../middleware/supabaseAuth'

const router = Router()

// Rota protegida - requer autenticação
router.get('/protected', supabaseAuth, async (req, res) => {
  // req.user contém o usuário autenticado do Supabase
  // req.supabase é um client Supabase com contexto do usuário (RLS aplicado)
  
  const userId = req.user!.id
  
  // Buscar dados com RLS
  const { data, error } = await req.supabase!
    .from('user_specific_table')
    .select('*')
  
  return res.json({ success: true, data })
})

// Rota com autenticação opcional
import { optionalAuth } from '../middleware/supabaseAuth'

router.get('/public', optionalAuth, async (req, res) => {
  // req.user pode ou não existir
  const isAuth = !!req.user
  
  return res.json({ 
    success: true, 
    data: { authenticated: isAuth } 
  })
})
```

### Exemplo Completo de Rota

```typescript
router.post('/projects/:id/tasks', supabaseAuth, async (req, res) => {
  try {
    const { id: projectId } = req.params
    const { title, description, assignee_id } = req.body
    const userId = req.user!.id
    
    // Verificar permissão via Supabase (RLS)
    const { data: project, error: projectError } = await req.supabase!
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
    
    if (projectError || !project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Projeto não encontrado ou sem permissão' }
      })
    }
    
    // Criar tarefa com RLS aplicado
    const { data: task, error: taskError } = await req.supabase!
      .from('tasks')
      .insert({
        project_id: projectId,
        title,
        description,
        assignee_id,
        created_by: userId
      })
      .select()
      .single()
    
    if (taskError) {
      throw taskError
    }
    
    return res.json({
      success: true,
      data: { task }
    })
  } catch (error: any) {
    console.error('Create task error:', error)
    return res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao criar tarefa' }
    })
  }
})
```

## Row Level Security (RLS)

### O que é RLS?

Row Level Security (RLS) permite definir políticas no banco de dados que controlam quais linhas cada usuário pode ver/modificar.

### Exemplo de Política RLS

```sql
-- Permitir que usuários vejam apenas seus próprios dados
CREATE POLICY "Users can view own data"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Permitir que admins vejam tudo
CREATE POLICY "Admins can view all data"
  ON user_profiles
  FOR SELECT
  USING (
    (SELECT user_metadata->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- Permitir que usuários editem apenas seus dados
CREATE POLICY "Users can update own data"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Habilitar RLS em Tabelas

```sql
-- Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Criar políticas (exemplos acima)
```

## Sincronização de Usuários

### Problema
Usuários existem no Supabase Auth, mas também precisamos de registros em tabelas customizadas (ex: `users` no Prisma).

### Solução 1: Trigger no Supabase

```sql
-- Criar função que cria registro na tabela users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Solução 2: Criar Manualmente

```typescript
// Backend - Após criar usuário no Supabase Auth
const { data: authUser } = await supabase.auth.admin.createUser({...})

if (authUser) {
  // Criar registro no Prisma
  await prisma.user.create({
    data: {
      id: authUser.user.id,
      email: authUser.user.email,
      name: authUser.user.user_metadata.name,
      role: authUser.user.user_metadata.role,
    }
  })
}
```

## Middleware Helper

### getAuthenticatedSupabaseClient

Criar um client Supabase autenticado manualmente:

```typescript
import { getAuthenticatedSupabaseClient } from '../middleware/supabaseAuth'

const userToken = req.headers.authorization?.replace('Bearer ', '')
if (userToken) {
  const userSupabase = getAuthenticatedSupabaseClient(userToken)
  
  const { data } = await userSupabase
    .from('table')
    .select('*')
}
```

## Boas Práticas

1. **Sempre use RLS**: Configure políticas para todas as tabelas sensíveis
2. **Use middleware `supabaseAuth`**: Para rotas que precisam de autenticação
3. **Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`** no frontend
4. **Valide permissões**: Mesmo com RLS, valide lógica de negócio no backend
5. **Log de erros**: Mantenha logs detalhados para debug
6. **Tokens curtos**: Configure TTL adequado para access tokens (padrão 1h)
7. **Refresh automático**: O Supabase client faz refresh automático do token

## Migração do Sistema Antigo

Se você tinha autenticação JWT customizada:

1. ✅ **Frontend**: `authStore` agora usa Supabase Auth
2. ✅ **Backend**: Rotas `/api/auth/*` agora usam Supabase
3. ✅ **Middleware**: `supabaseAuth` substituiu middleware JWT antigo
4. ⚠️ **Tokens antigos**: Não serão mais válidos
5. ⚠️ **Usuários**: Precisam ser recriados no Supabase Auth

### Script de Migração de Usuários

```typescript
// migrate-users.ts
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrateUsers() {
  const users = await prisma.user.findMany()
  
  for (const user of users) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: 'changeme123', // Senha temporária
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          runrun_user_id: user.runrun_user_id
        }
      })
      
      if (error) {
        console.error(`Error migrating ${user.email}:`, error)
      } else {
        console.log(`✅ Migrated ${user.email}`)
      }
    } catch (err) {
      console.error(`Error migrating ${user.email}:`, err)
    }
  }
}

migrateUsers()
```

## Troubleshooting

### Erro: "Invalid JWT Token"
- Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurada no backend
- Certifique-se de que o token está sendo enviado corretamente no header `Authorization`

### Erro: "Row Level Security policy violation"
- Configure políticas RLS para a tabela
- Verifique se o usuário tem permissão na política

### Sessão não persiste após reload
- Verifique se `persistSession: true` está configurado no client Supabase
- Verifique localStorage do navegador

### Refresh token não funciona
- Certifique-se de que `autoRefreshToken: true` está habilitado
- Verifique se o refresh token é válido

## Recursos Adicionais

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [JWT Verification](https://supabase.com/docs/guides/auth/server-side-auth)
