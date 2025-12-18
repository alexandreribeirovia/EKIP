# EKIP - Copilot Instructions

## Project Overview

**EKIP** (Enterprise Knowledge for Implementation Projects) is a consultant allocation management portal with TypeScript full-stack architecture:
- **Frontend**: React 18 + Vite + Tailwind CSS + AG-Grid + Recharts
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL (via Prisma schema) + Supabase (for specific features)
- **Auth**: **Supabase Auth** with JWT tokens + Zustand persist store (see `docs/SUPABASE_AUTH.md`)

## Architecture & Data Flow

### Dual Database Pattern
This project uses **both Prisma/PostgreSQL AND Supabase** concurrently:
- **Prisma (`backend/prisma/schema.prisma`)**: Core entities (User, Project, Employee, Allocation, Task)
- **Supabase**: Extended features (projects_phase, risks, time_worked, skills, off_days)
- Frontend directly queries Supabase for specific features (ProjectDetail phases/risks, TimeEntries)
- Backend API handles Prisma operations at `/api/*` routes

### State Management
- **Authentication**: Supabase Auth with Zustand persist store (`frontend/src/stores/authStore.ts`)
  - Session managed by Supabase (auto-refresh, multi-tab sync)
  - Store: `{ user, session, isAuthenticated, loading, login(), logout(), initializeAuth() }`
  - Initialize auth in App.tsx: `useEffect(() => initializeAuth(), [])`
- **No React Query**: Direct async/await with useState/useEffect patterns
- **Direct Supabase Calls**: Import from `frontend/src/lib/supabaseClient.ts` in pages
  - Client automatically uses authenticated session (RLS applied)

### Routing
- React Router v6 with `<ProtectedRoute>` wrapper checking `useAuthStore().isAuthenticated`
- Main routes: `/dashboard`, `/employees`, `/projects`, `/allocations`, `/time-entries`

## Key Conventions

### TypeScript Types
- **Shared types**: `shared/types/index.ts` defines interfaces matching Prisma models
- **Frontend types**: `frontend/src/types.ts` defines frontend-specific interfaces and types
- **Type organization**: ALWAYS define reusable interfaces in `types.ts`, NOT inline in component files
- **Enum naming**: Use UPPERCASE (e.g., `ProjectStatus.IN_PROGRESS`, `Priority.HIGH`)
- **Component-specific types**: Only define inline interfaces for very specific, non-reusable component props

### AG-Grid Tables
- Import: `import { AgGridReact } from 'ag-grid-react'` and `import { ColDef } from 'ag-grid-community'`
- Column definitions use `ColDef[]` with field, headerName, cellRenderer
- Default config: `defaultColDef={{ sortable: true, filter: true, resizable: true }}`
- See `frontend/src/pages/Projects.tsx` or `ProjectDetail.tsx` for patterns

### API Calls Pattern (OBRIGATÓRIO)

**REGRA: Todas as chamadas de API do frontend DEVEM usar o `apiClient`.**

O frontend NÃO deve fazer chamadas diretas ao Supabase. Use sempre o `apiClient` que:
- Injeta automaticamente o `sessionId` via header `X-Session-Id`
- Envia cookies httpOnly para refresh token
- Faz refresh automático da sessão quando expira (401)
- Retorna formato padronizado: `{ success: boolean, data?: T, error?: Error }`

```typescript
import apiClient from '../lib/apiClient'

// GET request
const response = await apiClient.get('/api/projects')
if (response.success) {
  setProjects(response.data)
} else {
  console.error(response.error?.message)
}

// POST request
const response = await apiClient.post('/api/projects', { name: 'Novo Projeto' })

// PATCH request
const response = await apiClient.patch(`/api/projects/${id}`, { status: 'active' })

// PUT request
const response = await apiClient.put(`/api/pdi/${id}`, { pdi, items })

// DELETE request
const response = await apiClient.del(`/api/projects/${id}`)
```

**Endpoints Disponíveis:**

| Módulo | Base URL | Descrição |
|--------|----------|-----------|
| Auth | `/api/auth` | Login, logout, refresh |
| Projects | `/api/projects` | Projetos, tasks, risks, phases |
| Employees | `/api/employees` | Funcionários e skills |
| Employee Detail | `/api/employee-detail` | Detalhes do funcionário |
| Evaluations | `/api/evaluations` | Modelos de avaliação |
| Employee Evaluations | `/api/employee-evaluations` | Avaliações de funcionários |
| Feedbacks | `/api/feedbacks` | Feedbacks |
| PDI | `/api/pdi` | Planos de Desenvolvimento Individual |
| Lookups | `/api/lookups` | Dados para dropdowns |
| Notifications | `/api/notifications` | Notificações |
| Allocations | `/api/allocations` | Alocações |
| Dashboard | `/api/dashboard` | Dados do dashboard |
| Domains | `/api/domains` | Domínios do sistema |
| Users | `/api/users` | Usuários |

**Ver documentação completa em:** `docs/ARCHITECTURE_API_SUPABASE.md`

### Backend Route Pattern

Todas as rotas do backend devem seguir este padrão:

```typescript
import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação em todas as rotas
router.use(sessionAuth)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('table_name')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar dados:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    return next(err)
  }
})

export default router
```

**Regras do Backend:**
- Sempre usar `sessionAuth` middleware para autenticação
- Usar `supabaseAdmin` para queries (bypass RLS) ou `req.supabaseUser` (com RLS)
- Retornar formato padronizado: `{ success: boolean, data?, error? }`
- Sempre usar try-catch com `next(err)` para erros
- Logar erros do Supabase antes de retornar

### API Response Format
Backend returns standardized format:
```typescript
// Sucesso
{ success: true, data: [...] }

// Erro
{ success: false, error: { message: string, code: string, details?: any } }
```

## Development Workflows

### Starting the Project
```powershell
# Root - starts both frontend (3000) and backend (5000)
npm run dev

# Or separately
cd frontend && npm run dev
cd backend && npm run dev

# With Docker
docker-compose up --build
```

### Database Migrations
```powershell
cd backend
npx prisma migrate dev       # Create/apply migration
npx prisma generate          # Regenerate Prisma Client
npx prisma studio            # Open GUI at localhost:5555
```

### Environment Setup
- Copy `backend/env.example` → `backend/.env`
- Copy `frontend/env.example` → `frontend/.env`
- **Required vars**: `DATABASE_URL`, `JWT_SECRET`, `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Feature-Specific Patterns

### CSV Upload (Project Progress)
- Supabase Storage bucket: `ProjectProgress`
- Edge function: `import_projects_phase` (called from frontend)
- Supports comma or semicolon delimiters (auto-detect)
- File naming: `project_{id}_week_{week}_{timestamp}.csv`
- See `docs/CSV_UPLOAD_GUIDE.md` for full spec

### Project Detail Tabs
The `ProjectDetail.tsx` component is tab-based:
1. **Tasks**: AG-Grid with inline editing
2. **Risks**: AG-Grid with owner cell editor (multi-select users)
3. **Status Report**: Recharts pie charts showing phase progress vs expected
4. **Progress Upload**: CSV import interface

### Authentication Flow
1. Login POST to `/api/auth/login` returns `{ user, token }`
2. Store in Zustand: `useAuthStore().login(user, token)`
3. Token auto-included in API calls (check axios config if implementing)
4. Logout clears store: `useAuthStore().logout()`

## Project-Specific Rules

### File Organization
- **Components**: Reusable UI in `frontend/src/components/`
- **Pages**: Route components in `frontend/src/pages/`
- **Routes**: Backend routes in `backend/src/routes/` (auth, projects, allocations, etc.)
- **Middleware**: Express middleware in `backend/src/middleware/`

### Styling
- **Tailwind CSS**: Use utility classes, custom config in `tailwind.config.js`
- **Dark mode**: Native dark mode support (`dark:` prefix)
- **Colors**: Primary orange/yellow palette (see STATUS_REPORT.md for hex values)

### Badge Pattern (rounded-full)
All status badges, priority indicators, and category tags should follow this standardized pattern with dark mode support:

```tsx
// Example: Status Badge Component
const StatusBadge = ({ value }: { value: string }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'aberto':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'em andamento':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'concluído':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'pendente':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
      {value}
    </span>
  );
};
```

**Badge Design Rules:**
- **Shape**: Always use `rounded-full` for pill-shaped badges
- **Padding**: Standard `px-2 py-1` for compact appearance
- **Text**: `text-xs font-medium` for readability
- **Colors**: Use light background with darker text in light mode (`bg-blue-100 text-blue-700`)
- **Dark Mode**: Use transparent overlay pattern (`dark:bg-blue-900/30 dark:text-blue-300`)
- **Color Palette**:
  - **Blue**: Info, Low Priority, Tasks (`bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`)
  - **Green**: Success, Completed (`bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300`)
  - **Yellow**: Warning, Pending, Medium Priority (`bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300`)
  - **Red**: Error, High Priority, Problems (`bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300`)
  - **Purple**: Special, Blocker, Risks (`bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300`)
  - **Orange**: Notifications, Counts (`bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300`)
  - **Gray**: Neutral, Undefined (`bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`)

**Examples in Use:**
- See `EmployeeDetail.tsx` evaluation status badges
- See `ProjectDetail.tsx` risk type, priority, and status badges
- Use this pattern consistently across all new features requiring status indicators

### Modal Pattern
All modals in the application should follow this standardized pattern (see `RiskModal.tsx` for reference):

```tsx
{showModal && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="p-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
        <h2 className="text-xl font-bold">
          Modal Title
        </h2>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Error display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Form fields with consistent styling */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Field Label: *
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

**Modal Design Rules:**
- **Backdrop**: `bg-black/60` (semi-transparent dark overlay)
- **Container**: `rounded-2xl shadow-2xl` with responsive max-width
- **Header**: Gradient `from-orange-500 to-red-500` with white text, sticky on scroll
- **Close button**: White with `hover:bg-white/20` effect, rounded full
- **Content padding**: `p-6` for form content, `p-5` for header
- **Input focus**: `focus:ring-1 focus:ring-orange-500` (consistent orange theme)
- **Primary action button**: Green (`bg-green-500`) for save/submit actions
- **Secondary action button**: Gray (`bg-gray-100 dark:bg-gray-700`) for cancel
- **Button padding**: `px-6 py-2` with `text-sm font-medium`
- **Max height**: `max-h-[90vh] overflow-y-auto` for scrollable content
- **Labels**: `text-sm font-medium` with `mb-1` spacing

### WYSIWYG Editor Pattern (ReactQuill)
For rich text input fields, use the ReactQuill WYSIWYG editor with standardized configuration (see `FeedbackModal.tsx` for reference):

```tsx
// Import dependencies
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// State management
const [content, setContent] = useState('');

// Render the WYSIWYG editor
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Field Label: *
  </label>
  <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
    <ReactQuill
      theme="snow"
      value={content}
      onChange={setContent}
      placeholder="Digite o conteúdo..."
      className="feedback-wysiwyg"
      modules={{
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'color': [] }, { 'background': [] }],
          ['link'],
          ['clean']
        ],
      }}
    />
  </div>
</div>
```

**WYSIWYG Editor Rules:**
- **Library**: Use `react-quill` package (already installed in project)
- **Theme**: Always use `theme="snow"` for consistent appearance
- **Container**: Wrap in `div` with border, rounded corners, and overflow-hidden
- **Border styling**: `border border-gray-300 dark:border-gray-600 rounded-lg`
- **Background**: `bg-white dark:bg-gray-800` for dark mode support
- **Custom class**: Use `feedback-wysiwyg` class for additional styling
- **Toolbar modules**: Standard set includes headers (H1-H3), bold, italic, underline, strike, ordered/bullet lists, text/background color, links, and clean formatting
- **Placeholder**: Always provide descriptive placeholder text
- **State**: Use string state variable with `value={content}` and `onChange={setContent}`
- **Styling in index.css**: Custom styles for dark mode are defined in `frontend/src/index.css` under `.feedback-wysiwyg`

**Required CSS (already in index.css):**
```css
/* ReactQuill Dark Mode Styles */
.feedback-wysiwyg .ql-toolbar {
  @apply bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600;
}

.feedback-wysiwyg .ql-container {
  @apply bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600;
  min-height: 150px;
}

.feedback-wysiwyg .ql-editor {
  @apply text-gray-900 dark:text-gray-100;
  min-height: 150px;
}

.feedback-wysiwyg .ql-editor.ql-blank::before {
  @apply text-gray-400 dark:text-gray-500;
}

.feedback-wysiwyg .ql-stroke {
  @apply stroke-gray-700 dark:stroke-gray-300;
}

.feedback-wysiwyg .ql-fill {
  @apply fill-gray-700 dark:fill-gray-300;
}

.feedback-wysiwyg .ql-picker-label {
  @apply text-gray-700 dark:text-gray-300;
}
```

**Examples in Use:**
- See `FeedbackModal.tsx` for public comment field
- Use this pattern for any long-form text input that benefits from formatting (comments, descriptions, notes, etc.)

### Notification Toast Pattern
All success/error notifications should use the standardized `NotificationToast` component (see `ProjectDetail.tsx` for reference):

```tsx
// Import required dependencies
import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, X } from 'lucide-react';

// Component definition
const NotificationToast = ({ type, message, onClose }: { 
  type: 'success' | 'error', 
  message: string, 
  onClose: () => void 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Função para limpar todos os timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Função para iniciar os timers
  const startTimers = useCallback(() => {
    clearTimers();
    const currentProgress = progress;
    const remainingTime = (currentProgress / 100) * 10000;
    
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, remainingTime);
    
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - 1;
        if (newProgress <= 0) return 0;
        return newProgress;
      });
    }, 100);
  }, [progress, onClose, clearTimers]);

  // Effect para controlar os timers baseado no hover
  useEffect(() => {
    if (!isHovered) {
      startTimers();
    } else {
      clearTimers();
    }
    return () => clearTimers();
  }, [isHovered, startTimers, clearTimers]);

  // Effect inicial para começar os timers
  useEffect(() => {
    startTimers();
    return () => clearTimers();
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const toastContent = (
    <div 
      className={`fixed top-4 right-4 z-[9999] rounded-xl shadow-2xl animate-slide-in-from-top border ${
        type === 'success' 
          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-800' 
          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200 text-red-800'
      } transform transition-all duration-300 ease-out max-w-md cursor-pointer overflow-hidden`}
      style={{ position: 'fixed', top: '4rem', right: '1rem', zIndex: 9999, pointerEvents: 'auto' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Barra de progresso */}
      <div className={`h-1 transition-all duration-100 ease-linear ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`} style={{ width: `${progress}%` }} />
      
      {/* Conteúdo do toast */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-white" />
          ) : (
            <XCircle className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{type === 'success' ? 'Sucesso!' : 'Erro!'}</p>
          <p className="text-xs opacity-90 whitespace-pre-line">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className={`ml-2 p-1 rounded-full transition-colors ${
            type === 'success' 
              ? 'text-green-400 hover:text-green-600 hover:bg-green-200' 
              : 'text-red-400 hover:text-red-600 hover:bg-red-200'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
};

// Usage in component
const [successNotification, setSuccessNotification] = useState<string | null>(null);

{successNotification && (
  <NotificationToast
    type="success"
    message={successNotification}
    onClose={() => setSuccessNotification(null)}
  />
)}
```

**Notification Toast Rules:**
- **Auto-close**: Toast closes automatically after 10 seconds
- **Progress bar**: Visual indicator showing remaining time (decrements 1% per 100ms)
- **Hover pause**: Mouse over toast pauses the timer; mouse out resumes from current position
- **Manual close**: X button closes immediately
- **Portal rendering**: Use `createPortal(content, document.body)` to render outside component hierarchy
- **Z-index**: Always use `z-[9999]` to ensure toast appears above all content
- **Animation**: Use `animate-slide-in-from-top` CSS class (defined in `index.css`)
- **Success style**: Green gradient (`from-green-50 to-green-100`), green border, CheckCircle icon
- **Error style**: Red gradient (`from-red-50 to-red-100`), red border, XCircle icon
- **Position**: Fixed at `top-4 right-4` (4rem from top, 1rem from right)
- **Never use alert()**: Always use NotificationToast for user feedback

### Error Handling
- Backend: Centralized middleware in `errorHandler.ts` and `notFound.ts`
- Frontend: Try-catch blocks with console.error and NotificationToast for user feedback

### Documentation
- API docs: Auto-generated Swagger at `http://localhost:5000/api-docs`
- Feature docs: `docs/` folder (API.md, CSV_UPLOAD_GUIDE.md, STATUS_REPORT.md)
- Database ERD: `supabase_erd.md` with Mermaid diagrams

## Common Gotchas

1. **Supabase queries in frontend**: Direct database access bypasses backend API - intentional for specific features
2. **No foreign keys between Prisma and Supabase tables**: Manual joins required (see ProjectDetail phases query)
3. **Week-based filtering**: Many features use `weekStart`/`weekEnd` date ranges for allocations
4. **Windows dev environment**: Use PowerShell commands; see `INSTALACAO_WINDOWS.md` for Node.js setup
5. **Rate limiting**: Backend has rate limiting (100 req/15min) and slow-down middleware

## Testing & Debugging

- **Health check**: `GET http://localhost:5000/health`
- **Prisma Studio**: Visual DB editor at `localhost:5555` (run `npx prisma studio`)
- **API docs**: Interactive Swagger UI at `/api-docs`
- **Console logging**: Both frontend and backend use extensive console logging for debugging
