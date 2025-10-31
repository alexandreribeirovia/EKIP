# Desenho de Solução - Tela de Funcionários

## 1. Arquitetura e Componentes

A tela de Funcionários é construída como um componente de página única no frontend, que interage diretamente com a base de dados (Supabase) para buscar os dados e utiliza uma biblioteca de grid para exibição e manipulação.

1.  **Frontend (React/Vite)**:
    -   **Componente Principal**: `frontend/src/pages/Employees.tsx`.
    -   **Responsabilidade**: Orquestrar a busca de dados, gerenciar o estado dos filtros, calcular estatísticas e renderizar a interface do usuário.
    -   **Gerenciamento de Estado**:
        -   `useState` é usado para armazenar a lista completa de funcionários (`employees`), os valores dos campos de filtro (`searchTerm`, `selectedSkill`, `statusFilter`).
        -   `useMemo` é utilizado para otimizar o desempenho. A filtragem da lista de funcionários (`filteredEmployees`) e o cálculo das estatísticas (`totalStats`) são memoizados, ou seja, só são recalculados quando os dados brutos ou os filtros mudam, evitando reprocessamento a cada renderização.
        -   `useRef` (`hasLoadedInitially`) é usado como um "flag" para garantir que a busca inicial de dados ocorra apenas uma vez, na montagem do componente.
    -   **Biblioteca de Grid**: `ag-grid-react` é usada para renderizar a tabela de dados. Ela oferece funcionalidades prontas como ordenação, redimensionamento de colunas e renderização eficiente de grandes volumes de dados.

2.  **Base de Dados (Supabase/PostgreSQL)**:
    -   **Tabelas Envolvidas**:
        -   `users`: Tabela principal que contém os dados cadastrais dos funcionários (nome, e-mail, cargo, status `is_active`, etc.).
        -   `skills`: Tabela de domínio com todas as habilidades possíveis.
        -   `users_skill`: Tabela de junção (pivot) que relaciona um usuário a uma habilidade.
    -   **Acesso aos Dados**: O frontend acessa os dados diretamente via API do Supabase (PostgREST), utilizando o cliente `@supabase/supabase-js`. A comunicação é segura e autenticada pelo JWT da sessão do usuário.

## 2. Fluxo de Dados e Interações

1.  **Busca Inicial de Dados**:
    -   No primeiro carregamento da página (`useEffect`), o componente `Employees.tsx` executa uma única consulta ao Supabase.
    -   A consulta é projetada para ser eficiente, buscando todos os dados necessários de uma só vez: `supabase.from('users').select('*, users_skill(skills(*))')`.
    -   Isso se traduz em uma única chamada de API que retorna um JSON com cada usuário e, aninhado dentro de cada usuário, um array com suas habilidades. Essa abordagem evita o problema "N+1 query".
    -   A lista completa de funcionários é armazenada no estado `employees`.

2.  **Filtragem no Cliente (Client-Side Filtering)**:
    -   Toda a lógica de busca e filtro é executada **no frontend**.
    -   Quando o usuário digita em um campo de busca ou altera um filtro, o hook `useMemo` é acionado.
    -   A função dentro do `useMemo` itera sobre o array `employees` (que contém todos os dados) e aplica a lógica de filtro (verificando nome, e-mail, habilidades e status).
    -   O resultado é uma nova lista, `filteredEmployees`, que é passada para o componente `AgGridReact` para ser renderizada.
    -   **Vantagem**: Esta abordagem é extremamente rápida para o usuário, pois não há novas chamadas de rede. A interface responde instantaneamente.
    -   **Desvantagem**: Pode não ser ideal para um número massivo de funcionários (dezenas de milhares), pois todos os dados são carregados na memória do navegador. Para a escala atual do projeto, é a abordagem mais eficiente.

3.  **Navegação**:
    -   O `AgGridReact` é configurado com um manipulador de eventos `onRowClicked`.
    -   Quando uma linha é clicada, este evento é disparado, fornecendo os dados da linha.
    -   O ID do usuário (`user_id`) é extraído dos dados e o `useNavigate` (do React Router) é usado para redirecionar o usuário para a página de detalhes (`/employees/${event.data.user_id}`).

## 3. Segurança

-   **Acesso Controlado por RLS**: Embora o frontend consulte a tabela `users` diretamente, a segurança é garantida pelas Políticas de Row-Level Security (RLS) configuradas no Supabase.
-   **Política de Acesso**: Deve haver uma política de RLS na tabela `users` (e tabelas relacionadas) que permita a operação de `SELECT` apenas para usuários autenticados (`auth.role() = 'authenticated'`). Isso impede que usuários anônimos acessem a lista de funcionários.
-   **Exposição de Dados**: A consulta retorna apenas os dados necessários para a exibição na lista. Informações sensíveis que não são relevantes para esta tela não devem ser incluídas na consulta `select`.

## 4. Desempenho e Otimização

-   **Busca Única de Dados**: A estratégia de carregar todos os dados na inicialização e filtrar no cliente é a principal otimização de desempenho, reduzindo a latência da rede durante o uso.
-   **Memoização**: O uso de `useMemo` previne cálculos desnecessários de filtragem e estatísticas, garantindo que a UI permaneça fluida.
-   **Virtualização do Grid**: `AgGridReact` utiliza virtualização de linhas (row virtualization) por padrão. Isso significa que apenas as linhas visíveis na tela são renderizadas no DOM, permitindo que a tabela lide com milhares de registros sem perda de desempenho.

## 5. Estrutura de Dados (Exemplo de Resposta da API)

A consulta ao Supabase retorna uma estrutura de dados semelhante a esta:

```json
[
  {
    "id": "uuid-do-usuario-1",
    "name": "Alice Silva",
    "email": "alice.silva@example.com",
    "position": "Desenvolvedora Frontend",
    "is_active": true,
    "avatar_large_url": "http://...",
    "users_skill": [
      {
        "skills": {
          "area": "DEV",
          "category": "Frontend",
          "skill": "React"
        }
      },
      {
        "skills": {
          "area": "DEV",
          "category": "Frontend",
          "skill": "TypeScript"
        }
      }
    ]
  },
  {
    "id": "uuid-do-usuario-2",
    "name": "Beto Costa",
    "email": "beto.costa@example.com",
    "position": "Analista de Dados",
    "is_active": true,
    "avatar_large_url": null,
    "users_skill": [
      {
        "skills": {
          "area": "DADOS",
          "category": "SQL",
          "skill": null
        }
      }
    ]
  }
]
```
