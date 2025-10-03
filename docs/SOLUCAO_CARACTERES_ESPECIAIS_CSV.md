# Solução para Problemas com Caracteres Especiais no CSV

## O Problema

Ao importar arquivos CSV com palavras que contêm acentuação (como "Homologação"), os caracteres especiais aparecem corrompidos (ex: "Homologa���o").

## A Solução Implementada

O sistema agora **detecta automaticamente** diferentes codificações de arquivo:

1. Tenta ler com UTF-8 primeiro
2. Se detectar caracteres corrompidos, tenta Windows-1252
3. Se ainda houver problemas, tenta ISO-8859-1 (Latin-1)

## Como Evitar o Problema

### Opção 1: Usar o Arquivo Modelo (Recomendado)

1. No modal de progresso, clique em **"Baixar Modelo CSV"**
2. O arquivo já será gerado com a codificação correta (UTF-8 com BOM)
3. Edite e salve normalmente

### Opção 2: Salvar Arquivo Excel como UTF-8

#### No Microsoft Excel:

1. Abra ou crie seu arquivo CSV
2. Vá em **Arquivo → Salvar Como**
3. Escolha o tipo **"CSV UTF-8 (delimitado por vírgula) (*.csv)"**
4. Salve o arquivo

#### No LibreOffice Calc:

1. Abra ou crie seu arquivo CSV
2. Vá em **Arquivo → Salvar Como**
3. Marque **"Editar configurações de filtro"**
4. Em "Conjunto de caracteres", escolha **"Unicode (UTF-8)"**
5. Salve o arquivo

#### No Google Sheets:

1. Abra sua planilha
2. Vá em **Arquivo → Download → Valores separados por vírgula (.csv)**
3. O Google Sheets já exporta em UTF-8 automaticamente

### Opção 3: Converter Arquivo Existente

Se você já tem um arquivo CSV com problema de codificação:

#### No Windows (Notepad):

1. Abra o arquivo CSV com o **Bloco de Notas** (Notepad)
2. Vá em **Arquivo → Salvar Como**
3. No campo "Codificação", escolha **"UTF-8"** ou **"UTF-8 com BOM"**
4. Salve o arquivo

#### No VS Code:

1. Abra o arquivo CSV
2. No canto inferior direito, clique na codificação atual (ex: "Windows 1252")
3. Escolha **"Salvar com codificação"**
4. Selecione **"UTF-8 with BOM"**

## Validação

Após salvar o arquivo:

1. Abra-o em um editor de texto
2. Verifique se os caracteres especiais (ç, ã, á, é, etc.) aparecem corretamente
3. Se aparecerem corretos, o arquivo pode ser importado sem problemas

## Mensagem de Progresso

Durante o upload, você verá mensagens como:

- **"Lendo arquivo..."** - Tentando ler com UTF-8
- **"Detectado problema de codificação, tentando Windows-1252..."** - Sistema detectou problema e está tentando outra codificação
- **"Tentando ISO-8859-1..."** - Última tentativa com codificação alternativa

## Ainda com Problemas?

Se mesmo após seguir estes passos o problema persistir:

1. Verifique se o nome das fases está exatamente como no banco de dados:
   - Levantamento
   - Desenvolvimento
   - **Homologação** (com "ç" e "ã")
   - Deploy
   - Acompanhamento

2. Baixe o arquivo modelo novamente e copie seus dados para ele

3. Certifique-se de que o arquivo não foi editado em um programa que altere a codificação

## Exemplo de Arquivo Correto

```csv
Projeto;Fase;Progresso;Progresso esperado;Ordem;Semana
Meu Projeto;Levantamento;50;50;1;1
Meu Projeto;Desenvolvimento;30;40;2;1
Meu Projeto;Homologação;0;0;3;1
Meu Projeto;Deploy;0;0;4;1
Meu Projeto;Acompanhamento;0;0;5;1
```

## Notas Técnicas

- O sistema suporta tanto vírgula (,) quanto ponto e vírgula (;) como delimitador
- A detecção de codificação é automática e transparente
- O BOM (Byte Order Mark) UTF-8 ajuda o Excel a reconhecer a codificação automaticamente
- Caracteres especiais suportados incluem todos os acentos do português (á, é, í, ó, ú, à, â, ê, ô, ã, õ, ç)

