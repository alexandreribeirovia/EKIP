# Documentação Funcional - Tela de Funcionários

## 1. Visão Geral

A tela de Funcionários é a área central para a gestão de colaboradores na plataforma EKIP. Ela oferece uma visão completa de todos os funcionários cadastrados, permitindo buscas, filtros e acesso rápido aos detalhes de cada um. O objetivo é fornecer aos gestores uma ferramenta eficiente para encontrar pessoas com base em nome, habilidades ou status.

## 2. Atores

- **Usuário Autenticado**: Qualquer usuário logado na plataforma com permissão para visualizar a lista de funcionários.

## 3. Regras Funcionais

### 3.1. Visualização Principal

-   **Lista de Funcionários**: A tela exibe uma tabela com todos os funcionários cadastrados. Por padrão, a lista é ordenada alfabeticamente pelo nome do funcionário.
-   **Colunas da Tabela**:
    -   **Funcionário**: Exibe a foto (avatar), se disponível, e o nome completo do funcionário.
    -   **Contato**: Exibe o e-mail do funcionário.
    -   **Cargo**: Exibe o cargo atual do funcionário (ex: "Desenvolvedor", "Analista de Dados").
    -   **Habilidades**: Exibe um resumo das principais habilidades do funcionário. Se a lista for longa, ela é abreviada, mas o texto completo pode ser visto ao passar o mouse sobre o campo.

### 3.2. Indicadores (Cards de Estatísticas)

Acima da tabela, são exibidos três indicadores principais que resumem o estado dos funcionários na base de dados:

-   **Total**: Mostra o número total de funcionários cadastrados.
-   **Ativos**: Mostra o número de funcionários com status "Ativo".
-   **Inativos**: Mostra o número de funcionários com status "Inativo".

*Estes números representam o total geral e não são afetados pelos filtros aplicados na tabela.*

### 3.3. Funcionalidades de Filtro e Busca

A tela oferece múltiplas maneiras de refinar a lista de funcionários:

-   **Busca por Nome, E-mail ou ID**:
    -   Um campo de busca permite que o usuário digite um termo.
    -   O sistema busca em tempo real por correspondências no **nome**, **e-mail** ou **ID** do funcionário. A busca não diferencia maiúsculas de minúsculas.

-   **Filtro por Habilidade**:
    -   Um campo de texto permite filtrar funcionários com base em suas habilidades.
    -   O usuário pode digitar parte do nome de uma habilidade (ex: "React", "SQL", "Python") e a lista será atualizada para mostrar apenas os funcionários que possuem aquela habilidade.

-   **Filtro por Status**:
    -   Um seletor permite filtrar os funcionários pelo seu status.
    -   **Opções**:
        -   `Ativo` (padrão): Mostra apenas funcionários ativos.
        -   `Inativo`: Mostra apenas funcionários inativos.
        -   `Todos`: Mostra todos os funcionários, independentemente do status.

-   **Limpar Filtros**:
    -   Um botão "Limpar Filtros" restaura a visualização para o estado inicial: remove todos os termos de busca e redefine o filtro de status para "Ativo".

### 3.4. Ações do Usuário

-   **Acessar Detalhes do Funcionário**:
    -   Ao clicar em qualquer linha da tabela, o usuário é redirecionado para a página de **detalhes** daquele funcionário (`/employees/{id_do_funcionario}`).
    -   A página de detalhes contém informações completas, como alocações, avaliações, PDI, etc.

## 4. Comportamento do Sistema

-   **Carregamento Inicial**: Ao acessar a tela pela primeira vez, o sistema busca a lista completa de funcionários e suas habilidades associadas.
-   **Aplicação de Filtros**: Os filtros são aplicados instantaneamente, à medida que o usuário digita ou seleciona uma opção. A tabela é atualizada em tempo real sem a necessidade de clicar em um botão "Aplicar".
-   **Navegação**: A interação principal é a navegação para a página de detalhes do funcionário, que serve como ponto de partida para outras ações relacionadas àquele colaborador.
