# Fluxo Funcional - Tela de Detalhes do Funcionário

Este documento descreve o fluxo de interação do usuário e o fluxo de dados para a tela de detalhes do funcionário na plataforma EKIP.

## Fluxo de Interação do Usuário (Frontend)

```mermaid
graph TD
    A[Usuário clica em um funcionário na lista de Funcionários] --> B{Sistema navega para a página de Detalhes do Funcionário};
    B --> C{Sistema carrega e exibe as informações gerais, habilidades e resumo de horas};
    C --> D{Aba Tarefas Atribuídas é exibida por padrão};

    subgraph "Navegação entre Abas"
        D -- Clica na aba 'Registro de Horas' --> E{Sistema carrega e exibe os registros de horas};
        E -- Clica na aba 'Feedbacks' --> F{Sistema carrega e exibe os feedbacks};
        F -- Clica na aba 'Avaliações' --> G{Sistema carrega e exibe as avaliações};
        G -- Clica na aba 'PDI' --> H{Sistema carrega e exibe os PDIs};
        H -- Clica na aba 'Acompanhamento' --> I{Sistema carrega e exibe os gráficos de desempenho};
        I -- Clica na aba 'Tarefas' --> D;
    end

    subgraph "Ações na Tela"
        C --> J{Usuário clica para adicionar/remover habilidade};
        J --> C;

        C --> K{Usuário clica para ativar/desativar funcionário};
        K --> C;

        D --> L{Usuário aplica filtros na lista de tarefas};
        L --> D;

        F --> M{Usuário clica em 'Novo Feedback'};
        M --> N[Modal de Feedback é aberto];
        N -- Salva ou fecha --> F;

        G --> O{Usuário clica em 'Nova Avaliação'};
        O --> P[Modal de Avaliação é aberto];
        P -- Salva ou fecha --> G;

        H --> Q{Usuário clica em 'Novo PDI'};
        Q --> R[Modal de PDI é aberto];
        R -- Salva ou fecha --> H;
        
        I --> S{Usuário clica em 'Tela Cheia'};
        S --> T[Aba de Acompanhamento ocupa a tela inteira];
        T -- Clica para sair --> I;
    end

    C --> U{Usuário clica em 'Voltar'};
    U --> V[Sistema retorna para a lista de Funcionários];
```

## Fluxo de Dados (Técnico)

```mermaid
sequenceDiagram
    participant User as Usuário
    participant Frontend as React App (EmployeeDetail.tsx)
    participant Supabase as Supabase DB

    User->>Frontend: 1. Acessa a rota /employees/:id
    
    Frontend->>Supabase: 2. GET /users?user_id=eq.:id (Busca dados do funcionário)
    Supabase-->>Frontend: 3. Retorna dados do funcionário
    Frontend->>Frontend: 4. Renderiza painel de informações gerais
    
    par Carregamento de Dados Iniciais
        Frontend->>Supabase: 5a. GET /tasks?responsible_id=eq.:id (Busca tarefas)
        Supabase-->>Frontend: Retorna lista de tarefas
        
        and
        
        Frontend->>Supabase: 5b. GET /time_worked (Busca horas dos últimos 3 meses)
        Supabase-->>Frontend: Retorna registros de horas
        
        and
        
        Frontend->>Supabase: 5c. GET /users_skill (Busca habilidades)
        Supabase-->>Frontend: Retorna lista de habilidades
    end
    
    Frontend-->>User: 6. Exibe dados nos painéis e na aba de tarefas
    
    alt Usuário troca para a aba "Feedbacks"
        User->>Frontend: 7a. Clica na aba "Feedbacks"
        Frontend->>Supabase: 8a. GET /feedbacks?feedback_user_id=eq.:id
        Supabase-->>Frontend: 9a. Retorna lista de feedbacks
        Frontend-->>User: 10a. Renderiza a tabela de feedbacks
    end

    alt Usuário adiciona uma habilidade
        User->>Frontend: 7b. Seleciona uma nova habilidade
        Frontend->>Supabase: 8b. POST /users_skill (body: {user_id, skill_id})
        Supabase-->>Frontend: 9b. Retorna sucesso
        Frontend->>Supabase: 10b. GET /users_skill (recarrega habilidades)
        Supabase-->>Frontend: 11b. Retorna lista atualizada
        Frontend-->>User: 12b. Atualiza a lista de habilidades na tela
    end
```
