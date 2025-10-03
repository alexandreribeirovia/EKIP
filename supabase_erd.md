# Diagrama ERD - Banco de Dados Supabase EKIP

```mermaid
erDiagram
    users {
        bigint id PK
        varchar user_id UK
        timestamptz created_at
        timestamptz updated_at
        varchar name
        varchar email
        varchar avatar_large_url
        varchar position
        bigint skill_id FK
        boolean on_vacation
        varchar birthday
        varchar phone
        boolean is_active
        date in_company_since
    }

    projects {
        bigint id PK
        bigint project_id UK
        timestamptz created_at
        timestamptz update_at
        timestamptz start_date
        timestamptz close_date
        boolean is_closed
        timestamptz desired_date
        bigint client_id
        varchar client_name
        varchar project_group_name
        varchar project_sub_group_name
        bigint tasks_count
        float8 tasks_count_progress
        bigint tasks_queued_count
        bigint tasks_working_on_count
        bigint tasks_closed_count
        bigint time_worked
        bigint time_pending
        bigint time_total
        float8 time_progress
        boolean is_active
        varchar name
    }

    tasks {
        bigint id PK
        bigint task_id UK
        timestamptz created_at
        timestamptz updated_at
        text title
        boolean is_closed
        text board_name
        text board_stage_name
        timestamptz gantt_bar_start_date
        timestamptz gantt_bar_end_date
        timestamptz desired_date
        timestamptz desired_start_date
        timestamptz desired_date_with_time
        int4 project_id FK
        text project_name
        text client_name
        varchar responsible_id
        text responsible_name
        int4 current_estimate_seconds
        int4 time_worked
        varchar type_name
        timestamptz close_date
        varchar user_id
        varchar billing_type
        varchar technology
    }

    assignments {
        bigint id PK
        timestamptz created_at
        timestamptz updated_at
        bigint task_id FK
        varchar assignee_id
        bigint team_id
        varchar assignee_name
        varchar team_name
        bigint current_estimate_seconds
        bigint time_worked
        timestamptz estimated_start_date
        timestamptz start_date
        timestamptz close_date
        boolean is_closed
    }

    time_worked {
        bigint id PK
        timestamptz created_at
        timestamptz updated_at
        date time_worked_date
        bigint project_id
        bigint task_id FK
        varchar user_id
        varchar project_name
        bigint client_id
        varchar client_name
        varchar task_title
        bigint type_id
        varchar type_name
        boolean task_is_closed
        timestamptz task_close_date
        timestamptz task_start_date
        varchar task_state
        bigint task_current_estimate_seconds
        bigint automatic_time
        bigint manual_time
        bigint time
        varchar user_name
    }

    skills {
        bigint id PK
        timestamptz created_at
        timestamptz update_at
        text area
        text category
        text skill
        boolean is_active
    }

    users_skill {
        bigint id PK
        timestamptz created_at
        timestamptz update_at
        bigint skill_id FK
        varchar user_id FK
    }

    domains {
        bigint id PK
        varchar type PK
        timestamptz created_at
        timestamptz update_at
        varchar value
        boolean is_active
    }

    off_days {
        bigint id PK
        bigint off_days_id UK
        date day
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    risks {
        bigint id PK
        timestamptz created_at
        timestamptz updated_at
        bigint project_id FK
        bigint type_id
        bigint priority_id
        varchar description
        varchar action_plan
        date start_date
        date forecast_date
        date close_date
        bigint status_id
    }

    risks_owner {
        bigint id PK
        timestamptz created_at
        timestamptz updated_at
        bigint risk_id FK
        varchar user_id FK
        varchar manual_owner
    }

    %% Relacionamentos
    users ||--o{ users_skill : "possui"
    skills ||--o{ users_skill : "é relacionada"
    
    projects ||--o{ tasks : "contém"
    projects ||--o{ risks : "possui"
    
    tasks ||--o{ assignments : "é atribuída"
    tasks ||--o{ time_worked : "registra tempo"
    
    risks ||--o{ risks_owner : "tem responsável"
    users ||--o{ risks_owner : "é responsável por"
```

## Descrição das Entidades

### 🏢 **Gestão de Pessoas**
- **users**: Funcionários da empresa
- **skills**: Habilidades técnicas
- **users_skill**: Relacionamento N:N entre usuários e habilidades

### 📋 **Gestão de Projetos**
- **projects**: Projetos da empresa
- **tasks**: Tarefas dos projetos
- **assignments**: Atribuições de tarefas para usuários/equipes

### ⏱️ **Controle de Tempo**
- **time_worked**: Registro detalhado de horas trabalhadas

### ⚠️ **Gestão de Riscos**
- **risks**: Riscos identificados nos projetos
- **risks_owner**: Responsáveis pelos riscos

### ⚙️ **Configurações**
- **domains**: Configurações e domínios do sistema
- **off_days**: Feriados e dias não úteis

## Características Técnicas
- ✅ Todas as tabelas possuem **Row Level Security (RLS)** habilitado
- 🔐 Controle de acesso granular aos dados
- 📊 Total de **42,486 registros** distribuídos nas tabelas
- 🕒 Campos de auditoria (created_at, updated_at) em todas as tabelas
