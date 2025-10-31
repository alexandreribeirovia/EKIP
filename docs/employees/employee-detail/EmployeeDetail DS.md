# Desenho de Solução - Tela de Detalhes do Funcionário

## 1. Arquitetura e Componentes

A tela de Detalhes do Funcionário é um componente complexo que atua como um "hub" de informações, agregando dados de múltiplas fontes. A arquitetura é focada em carregar dados sob demanda para manter a performance e a responsividade da interface.

1.  **Frontend (React/Vite)**:
    -   **Componente Principal**: `frontend/src/pages/EmployeeDetail.tsx`.
    -   **Responsabilidade**: Orquestrar todas as chamadas de dados, gerenciar o estado local complexo (dados do funcionário, listas de tarefas, feedbacks, abas ativas, filtros, etc.) e renderizar a estrutura de layout e os componentes visuais.
    -   **Componentes Reutilizáveis**:
        -   `FeedbackModal`, `EmployeeEvaluationModal`, `PDIModal`: Modais para criação e edição de registros, mantendo a lógica de formulário encapsulada.
        -   `AgGridReact`: Usado para exibir dados tabulares de forma eficiente (Registro de Horas, Feedbacks, Avaliações, PDIs).
        -   `Recharts`: Biblioteca de gráficos usada na aba "Acompanhamento" para renderizar os gráficos de Radar e Barras.
        -   `react-select`: Utilizado para os filtros de seleção múltipla e para o seletor hierárquico de habilidades.

2.  **Base de Dados (Supabase/PostgreSQL)**:
    -   **Fonte de Dados**: A tela consulta diretamente múltiplas tabelas do Supabase, incluindo `users`, `tasks`, `time_worked`, `feedbacks`, `evaluations`, `pdi`, `skills`, e suas tabelas de junção.
    -   **Acesso**: Todas as consultas são feitas através do cliente `@supabase/supabase-js` no frontend, autenticadas via JWT. A segurança é garantida por políticas de RLS.

## 2. Fluxo de Dados e Estratégia de Carregamento

A estratégia de carregamento de dados é fundamental para o desempenho desta tela.

1.  **Carregamento Inicial (Essencial)**:
    -   Ao montar o componente, a primeira ação é buscar os dados principais do funcionário (`/users?user_id=eq.:id`).
    -   Imediatamente após, são disparadas em paralelo as chamadas para os dados exibidos na visualização padrão:
        -   Tarefas (`tasks`).
        -   Habilidades (`users_skill`).
        -   Dados para o gráfico de horas dos últimos 3 meses (`time_worked`).
    -   Isso garante que a tela inicial seja renderizada rapidamente com as informações mais importantes.

2.  **Carregamento Sob Demanda (Lazy Loading)**:
    -   Os dados das abas não ativas **não são carregados** inicialmente.
    -   Um `useEffect` monitora a mudança da variável de estado `activeTab`.
    -   Quando o usuário clica em uma nova aba pela primeira vez, o `useEffect` dispara a função de carregamento correspondente (ex: `loadFeedbacks`, `loadEvaluations`).
    -   Os dados carregados são armazenados no estado do componente. Em cliques subsequentes na mesma aba, os dados são lidos do estado local, evitando novas chamadas à base de dados.

3.  **Filtragem e Manipulação de Dados no Cliente**:
    -   Similar à tela de Funcionários, a filtragem de tarefas (por projeto, cliente, status) é realizada no lado do cliente (`useMemo`). A lista completa de tarefas do usuário é mantida em memória, e uma lista filtrada é gerada para exibição, proporcionando uma experiência de usuário instantânea.

4.  **Cálculos Complexos**:
    -   **Horas Trabalhadas vs. Esperadas**: A lógica para calcular as horas úteis, descontando fins de semana e feriados (buscados da tabela `off_days`), é implementada em funções assíncronas no frontend. Para otimizar, os feriados de um período são pré-carregados (`preloadHolidays`) para evitar múltiplas chamadas ao banco.
    -   **Dados para Gráficos**: As funções como `loadEvaluationData` realizam agregações e transformações complexas nos dados brutos retornados do Supabase para formatá-los adequadamente para a biblioteca `Recharts`. Por exemplo, os dados de respostas de avaliações são pivotados para que cada avaliação se torne uma série no gráfico de radar.

## 3. Gerenciamento de Estado

-   O estado do componente é gerenciado primariamente pelo hook `useState` devido à sua complexidade e escopo local. São utilizados múltiplos `useState` para cada "pedaço" de dado (ex: `[employee, setEmployee]`, `[tasks, setTasks]`, `[feedbacks, setFeedbacks]`).
-   `useMemo` é usado para otimizar performance em cálculos derivados, como a filtragem de tarefas e a agregação de dados para gráficos.
-   `useRef` é utilizado para controle de lógica (prevenir carregamentos duplicados) e para referenciar elementos do DOM (necessário para o modo tela cheia).

## 4. Segurança

-   **Row-Level Security (RLS)**: A segurança é a principal preocupação, já que o frontend acessa dados sensíveis diretamente. Cada tabela consultada (`users`, `tasks`, `feedbacks`, etc.) deve ter políticas de RLS rigorosas que garantam que um usuário só possa ver:
    -   Seus próprios dados.
    -   Os dados de seus subordinados (se aplicável a uma estrutura de gestão).
    -   Dados permitidos por sua função (role).
-   **Exemplo de Política (para `feedbacks`)**: Uma política de `SELECT` na tabela `feedbacks` poderia permitir a leitura se `auth.uid() = feedback_user_id` (o próprio usuário) OU `auth.uid() = owner_user_id` (quem deu o feedback) OU se o solicitante for um gestor.
-   **Ações de Escrita (CUD)**: A criação, atualização e exclusão de registros (como Feedbacks, PDIs) também são controladas por políticas de RLS para a `INSERT`, `UPDATE`, e `DELETE`, garantindo que apenas usuários autorizados possam realizar essas ações.

## 5. Interatividade e UX

-   **Modais**: O uso de modais para ações de criação/edição (Feedback, Avaliação, PDI) evita a necessidade de navegar para outras páginas, mantendo o contexto do usuário na tela de detalhes.
-   **Feedback Visual**: Indicadores de carregamento (`Loader2`, `animate-spin`) são usados em todas as operações assíncronas para informar ao usuário que os dados estão sendo buscados.
-   **Tela Cheia**: A funcionalidade de tela cheia para a aba de "Acompanhamento" melhora a usabilidade para análise de dados e apresentações, utilizando a Fullscreen API do navegador.
-   **Seletores Hierárquicos**: O seletor de habilidades foi projetado para lidar com uma estrutura de três níveis (Área > Categoria > Habilidade), guiando o usuário através da seleção de forma intuitiva.
