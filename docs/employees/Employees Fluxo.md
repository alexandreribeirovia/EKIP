# Fluxo Funcional - Tela de Funcionários

Este documento descreve o fluxo de interação do usuário e o fluxo de dados para a tela de gestão de funcionários na plataforma EKIP.

## Fluxo de Interação do Usuário (Frontend)

```mermaid
graph TD
    A[Usuário acessa a página de Funcionários] --> B{Sistema carrega e exibe a lista de todos os funcionários ativos por padrão};
    B --> C{Usuário visualiza a tabela e os cards de estatísticas};
    
    subgraph "Ações de Filtragem"
        C --> D{Usuário digita no campo de busca};
        D --> E[Tabela é atualizada em tempo real com resultados];
        E --> C;

        C --> F{Usuário digita no campo de habilidade};
        F --> E;

        C --> G{"Usuário seleciona um status (Ativo, Inativo, Todos)"};
        G --> E;
        
        C --> H{Usuário clica em Limpar Filtros};
        H --> B;
    end

    subgraph "Ação Principal"
        C --> I{Usuário clica em uma linha da tabela};
        I --> J[Sistema redireciona para a página de Detalhes do Funcionário selecionado];
    end
```

## Fluxo de Dados (Técnico)

```mermaid
sequenceDiagram
    participant User as Usuário
    participant Frontend as React App (Employees.tsx)
    participant Supabase as Supabase DB (tabela 'users')

    User->>Frontend: 1. Acessa a rota /employees
    
    Frontend->>Supabase: 2. GET /rest/v1/users?select=*,users_skill(skills(*))
    Note over Frontend,Supabase: A query busca todos os usuários e faz um join implícito<br/>para trazer as habilidades relacionadas de cada um.
    
    Supabase-->>Frontend: 3. Retorna a lista de funcionários e suas habilidades
    
    Frontend->>Frontend: 4. Armazena os dados no estado do componente (useState)
    Frontend-->>User: 5. Renderiza a tabela com os dados e os cards de estatísticas
    
    alt Usuário aplica um filtro
        User->>Frontend: 6a. Digita no campo de busca ou altera um filtro
        Frontend->>Frontend: 7a. Reavalia a lista de funcionários em memória (useMemo)
        Note right of Frontend: Não há nova chamada ao banco de dados.<br/>A filtragem ocorre no lado do cliente.
        Frontend-->>User: 8a. Re-renderiza a tabela com a lista filtrada
    end

    alt Usuário clica em um funcionário
        User->>Frontend: 6b. Clica em uma linha da tabela
        Frontend->>Frontend: 7b. Obtém o ID do funcionário da linha clicada
        Frontend-->>User: 8b. Navega para a rota /employees/:id
    end
```
