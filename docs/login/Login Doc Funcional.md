# Documentação Funcional - Tela de Login

## 1. Visão Geral

A tela de Login é o ponto de entrada para a plataforma EKIP. Ela permite que usuários autenticados acessem o sistema, garantindo a segurança e a personalização da experiência. A tela é projetada para ser simples, intuitiva e segura, seguindo as melhores práticas de autenticação.

## 2. Atores

- **Usuário Não Autenticado**: Qualquer pessoa que acesse a URL da aplicação sem uma sessão ativa.

## 3. Regras Funcionais

### 3.1. Campos do Formulário

- **Email**:
    - **Obrigatório**: Sim.
    - **Formato**: Deve ser um endereço de e-mail válido (ex: `usuario@dominio.com`).
    - **Validação**: A validação de formato ocorre no frontend antes do envio.
    - **Placeholder**: "seu@email.com".

- **Senha**:
    - **Obrigatório**: Sim.
    - **Formato**: Mínimo de 6 caracteres (regra do Supabase Auth).
    - **Máscara**: O campo deve mascarar a senha (ex: `••••••••`) por padrão.
    - **Visibilidade**: Um ícone de "olho" permite ao usuário alternar a visibilidade da senha.

### 3.2. Ações do Usuário

- **Preenchimento do Formulário**:
    - O usuário deve preencher os campos de e-mail e senha.
    - Os campos são habilitados por padrão.

- **Submissão do Formulário**:
    - O usuário clica no botão "LOGIN".
    - A submissão pode ser acionada pela tecla "Enter" em qualquer um dos campos.
    - Durante o processo de login, o botão "LOGIN" fica desabilitado e exibe um indicador de carregamento ("Entrando..."). Os campos de e-mail e senha também são desabilitados.

- **Alternar Visibilidade da Senha**:
    - Ao clicar no ícone de "olho", o campo de senha alterna entre texto visível e mascarado.

- **Link "Problema de acesso?"**:
    - Ao clicar neste link, o usuário é redirecionado para a página de recuperação de senha (`/forgot-password`).

### 3.3. Processo de Autenticação

1.  O usuário preenche seu e-mail e senha e clica no botão "LOGIN".
2.  O sistema envia as informações de forma segura para verificação.
3.  O servidor central de autenticação confere se o e-mail e a senha estão corretos.
4.  **Se as informações estiverem corretas**:
    - O sistema concede uma permissão de acesso temporária e segura.
    - As informações do usuário são carregadas na plataforma.
    - O sistema registra que o usuário está conectado, permitindo que ele navegue para outras telas sem precisar se identificar novamente.
    - O usuário é direcionado para a tela principal da plataforma (Dashboard).
5.  **Se as informações estiverem incorretas**:
    - O sistema de autenticação informa que os dados são inválidos.
    - A plataforma exibe uma mensagem de erro na tela de login (ex: "Erro ao fazer login").
    - O usuário pode então corrigir as informações e tentar fazer o login novamente.

## 4. Mensagens de Feedback

- **Erro de Credenciais Inválidas**:
    - **Mensagem**: "Erro ao fazer login" ou a mensagem específica retornada pela API (ex: "Invalid login credentials").
    - **Gatilho**: Usuário informa e-mail ou senha incorretos.
    - **Apresentação**: Uma caixa de alerta vermelha aparece acima do botão de login.

- **Erro de Conexão / Inesperado**:
    - **Mensagem**: "Ocorreu um erro inesperado." ou a mensagem específica do erro de rede.
    - **Gatilho**: Falha na comunicação com a API (servidor offline, problema de rede).
    - **Apresentação**: Uma caixa de alerta vermelha.

- **Carregamento**:
    - **Mensagem**: O texto do botão muda para "Entrando..." com um ícone de carregamento.
    - **Gatilho**: Durante a requisição de login.
    - **Apresentação**: O botão de login fica desabilitado.

## 5. Elementos da Tela

- **Logo da EKIP**: Identidade visual da aplicação.
- **Título**: "Bem-vindo ao EKIP".
- **Subtítulo**: "Faça login para acessar a plataforma!".
- **Campo de Email**: Input para o e-mail do usuário.
- **Campo de Senha**: Input para a senha do usuário com controle de visibilidade.
- **Link "Problema de acesso?"**: Navega para a tela de recuperação de senha.
- **Botão "LOGIN"**: Inicia o processo de autenticação.
- **Rodapé**: "Desenvolvido por Via Consulting".
