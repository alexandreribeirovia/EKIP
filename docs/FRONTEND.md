# TEAM Frontend Documentation

## Tecnologias Utilizadas

- **React 18** - Biblioteca principal para UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS com dark mode
- **AG-Grid** - Tabelas avançadas e interativas
- **Recharts** - Gráficos e visualizações
- **React Router** - Navegação entre páginas
- **React Query** - Gerenciamento de estado e cache
- **React Hook Form** - Formulários
- **Zustand** - Gerenciamento de estado global
- **Lucide React** - Ícones
- **Vite** - Build tool e dev server

## Estrutura de Pastas

```
frontend/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── Layout.tsx       # Layout principal
│   │   ├── ProtectedRoute.tsx
│   │   └── ui/              # Componentes de UI básicos
│   ├── pages/               # Páginas da aplicação
│   │   ├── Dashboard.tsx
│   │   ├── Employees.tsx
│   │   ├── Allocations.tsx
│   │   ├── Projects.tsx
│   │   └── Login.tsx
│   ├── stores/              # Stores do Zustand
│   │   └── authStore.ts
│   ├── hooks/               # Custom hooks
│   ├── services/            # Serviços de API
│   ├── utils/               # Utilitários
│   ├── types/               # Tipos TypeScript
│   ├── App.tsx              # Componente principal
│   ├── main.tsx             # Entry point
│   └── index.css            # Estilos globais
├── public/                  # Arquivos estáticos
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Componentes Principais

### Layout
O componente `Layout` é responsável pela estrutura principal da aplicação:
- Sidebar colapsável
- Header com informações do usuário
- Toggle de dark mode
- Navegação principal

### Dashboard
Página principal com:
- Cards de métricas
- Gráficos de performance
- Tabela de alocações recentes
- Visão geral de projetos

### Matriz Semanal (Allocations)
- Visualização semanal de alocações
- Drag & drop para realocação
- Filtros por projeto/funcionário
- Exportação de relatórios

## Configuração do Tailwind CSS

O projeto utiliza Tailwind CSS com configuração customizada:

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          // ... outras variações
          900: '#7c2d12',
        }
      }
    }
  }
}
```

## Dark Mode

O dark mode é implementado usando a classe `dark` no elemento `html`:

```typescript
// Toggle dark mode
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark')
  localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'))
}
```

## Gerenciamento de Estado

### Zustand Store (Auth)
```typescript
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
}
```

### React Query
Para gerenciamento de estado do servidor e cache:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

## Integração com AG-Grid

Exemplo de implementação de tabela:

```typescript
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

const columnDefs = [
  { field: 'name', headerName: 'Nome' },
  { field: 'email', headerName: 'Email' },
  { field: 'department', headerName: 'Departamento' },
]

const EmployeesTable = () => {
  return (
    <div className="ag-theme-alpine h-96">
      <AgGridReact
        columnDefs={columnDefs}
        rowData={employees}
        pagination={true}
        paginationPageSize={10}
      />
    </div>
  )
}
```

## Integração com Recharts

Exemplo de gráfico:

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

const data = [
  { name: 'Jan', planned: 400, actual: 380 },
  { name: 'Feb', planned: 300, actual: 320 },
  // ...
]

const HoursChart = () => {
  return (
    <LineChart width={600} height={300} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="planned" stroke="#f97316" />
      <Line type="monotone" dataKey="actual" stroke="#10b981" />
    </LineChart>
  )
}
```

## Formulários com React Hook Form

```typescript
import { useForm } from 'react-hook-form'

interface FormData {
  name: string
  email: string
  department: string
}

const EmployeeForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>()

  const onSubmit = (data: FormData) => {
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('name', { required: 'Nome é obrigatório' })}
        className="input"
      />
      {errors.name && <span>{errors.name.message}</span>}
      
      <button type="submit" className="btn btn-primary">
        Salvar
      </button>
    </form>
  )
}
```

## Rotas Protegidas

```typescript
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  return <>{children}</>
}
```

## Variáveis de Ambiente

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME="EKIP - Enterprise Knowledge for Implementation & Projects"
VITE_OAUTH_CLIENT_ID="your-oauth-client-id"
```

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run preview` - Preview do build
- `npm run lint` - Linting do código

## Deploy

### Build para Produção
```bash
npm run build
```

### Docker
```bash
docker build -t team-frontend .
docker run -p 3000:3000 team-frontend
```

## Performance

- **Code Splitting** automático com Vite
- **Lazy Loading** de componentes
- **Tree Shaking** para reduzir bundle size
- **Caching** com React Query
- **Optimized Images** com lazy loading 