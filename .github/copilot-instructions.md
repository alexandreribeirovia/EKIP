# EKIP - Copilot Instructions

## Project Overview

**EKIP** (Enterprise Knowledge for Implementation Projects) is a consultant allocation management portal with TypeScript full-stack architecture:
- **Frontend**: React 18 + Vite + Tailwind CSS + AG-Grid + Recharts
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL (via Prisma schema) + Supabase (for specific features)
- **Auth**: JWT tokens with Zustand persist store

## Architecture & Data Flow

### Dual Database Pattern
This project uses **both Prisma/PostgreSQL AND Supabase** concurrently:
- **Prisma (`backend/prisma/schema.prisma`)**: Core entities (User, Project, Employee, Allocation, Task)
- **Supabase**: Extended features (projects_phase, risks, time_worked, skills, off_days)
- Frontend directly queries Supabase for specific features (ProjectDetail phases/risks, TimeEntries)
- Backend API handles Prisma operations at `/api/*` routes

### State Management
- **Authentication**: Zustand persist store (`frontend/src/stores/authStore.ts`) - stores user, token, isAuthenticated
- **No React Query**: Direct async/await with useState/useEffect patterns
- **Direct Supabase Calls**: Import from `frontend/src/lib/supabaseClient.ts` in pages

### Routing
- React Router v6 with `<ProtectedRoute>` wrapper checking `useAuthStore().isAuthenticated`
- Main routes: `/dashboard`, `/employees`, `/projects`, `/allocations`, `/time-entries`

## Key Conventions

### TypeScript Types
- **Shared types**: `shared/types/index.ts` defines interfaces matching Prisma models
- **Enum naming**: Use UPPERCASE (e.g., `ProjectStatus.IN_PROGRESS`, `Priority.HIGH`)
- **Supabase types**: Define inline interfaces with `Db` prefix (e.g., `DbProjectPhase`) in component files

### AG-Grid Tables
- Import: `import { AgGridReact } from 'ag-grid-react'` and `import { ColDef } from 'ag-grid-community'`
- Column definitions use `ColDef[]` with field, headerName, cellRenderer
- Default config: `defaultColDef={{ sortable: true, filter: true, resizable: true }}`
- See `frontend/src/pages/Projects.tsx` or `ProjectDetail.tsx` for patterns

### Supabase Queries
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*, related_table(*)')
  .eq('field', value)
```
- Always destructure `{ data, error }` and check error
- Use `.select()` with joins for related tables
- Foreign key joins are NOT enforced - manual joins in JS code when needed (see ProjectDetail phases)

### API Responses
Backend returns standardized format:
```typescript
{ success: boolean, data?: T, error?: { message, code, details } }
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

### Error Handling
- Backend: Centralized middleware in `errorHandler.ts` and `notFound.ts`
- Frontend: Try-catch blocks with console.error and user notifications (toast pattern assumed)

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
