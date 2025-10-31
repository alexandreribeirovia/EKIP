# Desenho de Solução - Tela de Login

## 1. Arquitetura e Componentes

A funcionalidade de login envolve três componentes principais que interagem de forma orquestrada:

1.  **Frontend (React/Vite)**:
    -   **Componente**: `frontend/src/pages/Login.tsx`.
    -   **Responsabilidade**: Renderizar a interface de usuário, capturar as credenciais, gerenciar o estado da UI (carregamento, erro) e se comunicar com o backend.
    -   **Gerenciamento de Estado**: Utiliza o `useState` para os campos do formulário e estado de carregamento/erro. O `Zustand` (`authStore`) é usado para armazenar o estado de autenticação global após o login bem-sucedido.
    -   **Cliente Supabase**: O frontend possui uma instância do cliente Supabase (`@supabase/supabase-js`) que é usada para configurar a sessão do usuário após o login.

2.  **Backend (Node.js/Express)**:
    -   **Endpoint**: `POST /api/auth/login`.
    -   **Controlador**: `backend/src/routes/auth.ts`.
    -   **Responsabilidade**: Atuar como um intermediário seguro (BFF - Backend for Frontend). Ele recebe as credenciais do frontend, as repassa para o serviço de autenticação (Supabase Auth) e retorna uma resposta padronizada para o cliente. Ele não armazena senhas ou sessões.

3.  **Serviço de Autenticação (Supabase Auth)**:
    -   **Provedor**: Serviço gerenciado da Supabase.
    -   **Responsabilidade**: Gerenciar de forma segura as identidades dos usuários, validar credenciais, emitir e verificar JSON Web Tokens (JWTs). É a fonte da verdade para a autenticação.

## 2. Fluxo de Dados e Interações

O processo de login segue um fluxo de "backend-brokered authentication" (autenticação intermediada pelo backend):

1.  **Coleta de Credenciais (Frontend)**: O formulário em `Login.tsx` coleta `email` e `password`.
2.  **Requisição para o Backend (Frontend → Backend)**: Ao submeter, o frontend envia uma requisição `POST` para `/api/auth/login` com as credenciais no corpo da requisição.
3.  **Validação de Credenciais (Backend → Supabase)**: O backend recebe a requisição e usa o SDK Admin da Supabase (`@supabase/supabase-js` com a `service_role_key`) para chamar a função `signInWithPassword()`. Esta chamada é feita em um ambiente seguro de servidor.
4.  **Emissão de JWT (Supabase)**: Se as credenciais estiverem corretas, o Supabase Auth gera um `access_token` (JWT de curta duração) e um `refresh_token` (de longa duração).
5.  **Retorno dos Tokens (Supabase → Backend → Frontend)**: Os tokens são retornados ao backend, que os repassa ao frontend dentro de uma estrutura de resposta padronizada.
6.  **Configuração da Sessão no Cliente (Frontend)**:
    -   Este é um passo **crítico**. O frontend recebe os tokens e imediatamente os injeta em sua própria instância do cliente Supabase usando `supabase.auth.setSession()`.
    -   **Impacto**: A partir deste momento, qualquer chamada feita pela instância do Supabase no frontend (ex: `supabase.from('tabela').select('*')`) incluirá automaticamente o `access_token` no cabeçalho `Authorization`. Isso permite que o frontend interaja diretamente com as APIs da Supabase (PostgREST) de forma segura, aproveitando as políticas de RLS (Row-Level Security).
7.  **Persistência do Estado (Frontend)**: O estado de autenticação (`isAuthenticated = true`), junto com os dados do usuário, é salvo no `authStore` do Zustand, que por sua vez persiste os dados no `localStorage` do navegador para manter a sessão entre recargas de página.

## 3. Segurança

-   **Comunicação Segura**: Toda a comunicação entre cliente, backend e Supabase deve ocorrer sobre HTTPS (TLS).
-   **Não Exposição de Chaves Sensíveis**: A `service_role_key` da Supabase, que tem privilégios de administrador, é usada **apenas** no backend e nunca é exposta no frontend. O frontend utiliza apenas a `anon_key`, que é pública e segura para ser exposta.
-   **Proteção contra CSRF**: Como a autenticação é baseada em JWTs enviados em cabeçalhos `Authorization`, e não em cookies de sessão, a aplicação é menos vulnerável a ataques CSRF (Cross-Site Request Forgery) tradicionais.
-   **Validação de Entrada**: O backend deve validar e sanitizar as entradas (email, senha) para prevenir ataques de injeção.
-   **Gerenciamento de JWT**:
    -   O `access_token` é de curta duração (padrão: 1 hora), limitando a janela de oportunidade caso seja comprometido.
    -   O `refresh_token` é usado para obter novos `access_token`s de forma silenciosa, sem exigir que o usuário faça login novamente. O cliente Supabase gerencia esse processo de atualização de token automaticamente.
-   **Políticas de RLS (Row-Level Security)**: A segurança do acesso direto a dados do frontend para a Supabase depende inteiramente da correta implementação de políticas de RLS no banco de dados. As políticas devem garantir que um usuário autenticado (`auth.uid()`) só possa acessar os dados que lhe são permitidos.

## 4. Relacionamentos

-   **`Login.tsx`**: Depende do `authStore` (Zustand) para o gerenciamento de estado global e do `supabaseClient` para a configuração da sessão.
-   **`auth.ts` (Backend Route)**: Depende do SDK Admin da Supabase para se comunicar com o serviço de autenticação.
-   **`ProtectedRoute.tsx`**: Componente de roteamento que depende do estado `isAuthenticated` do `authStore` para proteger rotas que exigem autenticação.
-   **`supabaseClient.ts`**: Configura e exporta a instância do cliente Supabase para ser usada em toda a aplicação frontend.

## 5. Escalabilidade e Desempenho

-   **Stateless Backend**: A API de login é stateless. A sessão do usuário é mantida no frontend e validada pelo Supabase a cada requisição, o que facilita a escalabilidade horizontal do backend.
-   **Desempenho**: O processo de login envolve uma viagem de ida e volta do cliente para o backend e do backend para a Supabase. A latência dependerá da localização geográfica desses serviços. O uso de um CDN e a proximidade dos servidores da aplicação e do banco de dados são importantes.
-   **Limitação de Taxa (Rate Limiting)**: O endpoint de login no backend deve ter um mecanismo de limitação de taxa para mitigar ataques de força bruta.
