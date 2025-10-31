# Documentação Funcional - Tela de Detalhes do Funcionário

## 1. Visão Geral

A tela de Detalhes do Funcionário é uma visão 360 graus do colaborador dentro da empresa. Ela consolida todas as informações relevantes sobre um funcionário específico, desde seus dados cadastrais e habilidades até seu envolvimento em tarefas, registros de horas, feedbacks recebidos, avaliações de desempenho e planos de desenvolvimento. O objetivo é fornecer um local centralizado para que gestores e o próprio funcionário possam acompanhar seu progresso e histórico na organização.

## 2. Atores

-   **Usuário Autenticado**: Qualquer usuário logado com permissão para visualizar os detalhes de outros funcionários.

## 3. Estrutura da Tela

A tela é dividida em duas seções principais: um painel esquerdo com informações resumidas e um painel direito com informações detalhadas organizadas em abas.

### 3.1. Cabeçalho e Painel de Informações Gerais

-   **Navegação**: Um botão "Voltar" permite ao usuário retornar facilmente para a lista de funcionários.
-   **Card de Identificação**:
    -   Exibe a foto (ou iniciais), nome completo e cargo do funcionário.
    -   **Status**: Um indicador visual mostra se o funcionário está "Ativo" ou "Inativo". Um botão ao lado permite alterar esse status.
    -   **Lança Horas**: Um indicador visual mostra se o funcionário está habilitado a lançar horas. Um botão ao lado permite alterar essa permissão.
    -   **Dados Pessoais**: Apresenta informações como e-mail, data de nascimento (com idade calculada), telefone e data de início na empresa (com tempo de casa calculado).

### 3.2. Painel Esquerdo (Resumos)

-   **Habilidades**:
    -   Lista as competências técnicas e comportamentais do funcionário.
    -   Um botão "Adicionar" permite que um gestor associe novas habilidades ao perfil do colaborador a partir de uma lista pré-definida.
    -   Cada habilidade listada pode ser removida individualmente.

-   **Horas Lançadas**:
    -   Apresenta um resumo gráfico dos últimos 3 meses de horas trabalhadas.
    -   Para cada mês, uma barra de progresso mostra:
        -   **Horas Lançadas**: Total de horas que o funcionário registrou.
        -   **Horas Esperadas**: Total de horas úteis que deveriam ter sido trabalhadas até a data atual no mês.
        -   **Total de Horas do Mês**: Total de horas úteis no mês completo.
    -   Um alerta visual indica se o funcionário está com horas extras (`Extra Xh`) ou horas faltantes (`Faltam Xh`) em relação ao esperado.

### 3.3. Painel Direito (Abas de Detalhes)

Esta é a área principal da tela, onde as informações são aprofundadas.

-   **Aba "Tarefas Atribuídas"**:
    -   Exibe uma lista de todas as tarefas associadas ao funcionário.
    -   **Filtros**: Permite filtrar as tarefas por Projeto, Cliente e Status (Abertos, Fechados, Todos).
    -   **Indicadores**: Mostra o número total de tarefas, quantas estão ativas, quantas foram entregues e o total exibido após a aplicação dos filtros.
    -   **Detalhes da Tarefa**: Cada tarefa é exibida em um card com informações como ID, título, projeto, cliente, datas de criação, início e entrega, e horas previstas vs. executadas.
    -   **Cor do Card**: A cor do card da tarefa muda para indicar seu status:
        -   **Vermelho**: Tarefa atrasada.
        -   **Amarelo**: Tarefa do tipo "Happy Day" ou "Férias".
        -   **Branco/Padrão**: Tarefa dentro do prazo.

-   **Aba "Registro de Horas"**:
    -   Apresenta uma tabela detalhada com todos os lançamentos de horas do funcionário.
    -   **Filtro de Mês**: Permite selecionar um mês específico para visualizar os registros.
    -   **Colunas**: Data, Projeto, Tarefa e Tempo trabalhado.

-   **Aba "Feedbacks"**:
    -   Exibe uma tabela com o histórico de todos os feedbacks recebidos pelo funcionário.
    -   **Ações**: Permite **adicionar**, **editar** ou **excluir** um feedback.
    -   **Colunas**: Data, Responsável (quem deu o feedback), Tipo (Elogio, Orientação, Melhoria, etc.) e o Comentário.
    -   **Indicador Visual**: O "Tipo" de feedback é exibido como uma etiqueta colorida para fácil identificação.

-   **Aba "Avaliações"**:
    -   Lista todas as avaliações de desempenho associadas ao funcionário.
    -   **Ações**: Permite iniciar uma **nova avaliação** ou **excluir** uma existente.
    -   **Colunas**: Nome da Avaliação, Avaliador, Período e Status (Pendente, Em andamento, Concluído).
    -   **Navegação**: Clicar em uma avaliação leva o usuário para a tela de resposta daquela avaliação específica.

-   **Aba "PDI" (Plano de Desenvolvimento Individual)**:
    -   Mostra a lista de PDIs criados para o funcionário.
    -   **Ações**: Permite criar um **novo PDI**, **editar** um PDI em andamento ou **excluir** um PDI.
    -   **Colunas**: Responsável (quem criou o PDI), número de Competências em desenvolvimento, e Status (Aberto, Em andamento, Concluído).

-   **Aba "Acompanhamento"**:
    -   Um dashboard visual para análise de desempenho a longo prazo.
    -   **Gráfico de Desempenho (Radar)**: Mostra a evolução das notas do funcionário em diferentes competências ao longo de múltiplas avaliações. Uma linha pontilhada representa a média do time para comparação.
    -   **Gráfico de Feedbacks por Tipo**: Um gráfico de barras que quantifica os tipos de feedback recebidos (quantos elogios, quantas orientações, etc.).
    -   **Histórico de Horas por Cliente**: Uma lista que totaliza as horas trabalhadas para cada cliente, podendo ser expandida para ver a distribuição de horas por projeto dentro daquele cliente.
    -   **Modo Tela Cheia**: Um botão permite expandir esta aba para ocupar a tela inteira, facilitando a visualização e apresentação dos gráficos.
