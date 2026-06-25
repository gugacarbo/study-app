---
status: draft
date: 2026-06-25
builds-on: [SPEC-0021, SPEC-0025]
implemented-by: []
---

# UI em painel para a página dedicada da questão

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Reformular a UI de `/exams/$examId/questions/$questionId` para que a página funcione como
um painel de revisão e edição, não apenas como uma visualização linear da questão.

O foco desta spec é visual e estrutural:

1. dar mais peso à navegação entre questões;
2. tornar as ações principais mais acessíveis;
3. manter a leitura da questão visível enquanto a edição acontece;
4. organizar draft pendente, conteúdo e formulário em regiões com papéis claros.

Esta spec não altera contratos de dados, mutações ou rotas definidos em SPEC-0021 e
SPEC-0025.

## Fluxo

1. O usuário abre `/exams/$examId/questions/$questionId`.
2. A página renderiza uma toolbar superior com prioridade visual para navegação e ações.
3. Abaixo da toolbar, o layout se divide em regiões:
   - área principal com enunciado, alternativas e comparação de melhoria;
   - área lateral com contexto e edição.
4. Em desktop, ao clicar em `Editar pergunta`, o formulário abre na coluna lateral sem
   substituir a visualização principal da questão.
5. Em mobile, a mesma hierarquia é preservada por empilhamento: toolbar, conteúdo principal,
   painel lateral.
6. Se existir draft pendente, a página mantém o fluxo de aprovar/descartar, mas o bloco passa
   a ter aparência de painel de revisão integrado ao restante da tela.

## Contrato

### Hierarquia visual

A página dedicada DEVE ser organizada em três camadas visuais:

1. `Toolbar`: navegação global da questão.
2. `Conteúdo principal`: leitura e revisão da questão.
3. `Painel lateral`: ações, contexto e edição.

### Toolbar superior

A toolbar DEVE:

- destacar `Questão anterior` e `Próxima questão` como ações de primeira ordem;
- manter ação de voltar para `/exams/$examId`;
- exibir a posição atual (`Q{n} de {total}`);
- manter contexto suficiente da questão atual, sem competir com a navegação.

Na toolbar, a ênfase visual deve priorizar:

1. navegação entre questões;
2. ações primárias do fluxo (`Editar`, `Aprovar melhoria`, `Descartar`);
3. contexto secundário (`Q{n}`, tópico).

### Layout em desktop

Em larguras de desktop, a página DEVE usar duas regiões:

- coluna principal larga para leitura;
- coluna lateral para ações e edição.

Regras:

- o enunciado e as alternativas permanecem sempre na coluna principal;
- a edição NÃO substitui a visualização principal;
- ao entrar em modo de edição, o formulário aparece na coluna lateral;
- a coluna lateral pode exibir um estado compacto quando não estiver editando.

### Layout em mobile

Em mobile, a página DEVE empilhar as regiões sem perder ordem de prioridade:

1. toolbar;
2. conteúdo principal;
3. painel lateral.

Não é obrigatório manter coluna lateral fixa em mobile; a adaptação pode ser por blocos
verticais, desde que preserve clareza de navegação e ações.

### Conteúdo principal

O bloco principal DEVE conter:

- rótulo da questão (`Q{n} · tópico`);
- enunciado em Markdown;
- alternativas com contraste superior ao atual;
- destaque mais evidente para respostas corretas;
- bloco de melhoria pendente quando existir.

O bloco principal NÃO DEVE conter o formulário de edição em desktop.

### Painel lateral

O painel lateral DEVE assumir dois estados:

- `estado de resumo`, quando a questão não está em edição;
- `estado de edição`, quando `Editar pergunta` foi acionado.

No estado de resumo, o painel DEVE expor ao menos:

- ação principal `Editar pergunta`;
- contexto curto da questão;
- status relacionado a draft, quando aplicável.

No estado de edição, o painel DEVE renderizar `QuestionEditForm` preservando:

- `useUpdateQuestion`;
- salvar e cancelar;
- atualização local da questão após sucesso.

### Draft pendente

Quando houver draft de melhoria:

- a página DEVE continuar exibindo o resumo textual da melhoria;
- a comparação `Original` vs `Melhorada` permanece no conteúdo principal;
- `Aprovar melhoria` e `Descartar melhoria` devem ficar mais acessíveis do que hoje, de
  preferência integrados à toolbar ou ao painel lateral.

### Reaproveitamento

- `ExamQuestionPage` continua sendo a composição de alto nível.
- `ExamQuestionItem` pode ser dividido em subcomponentes visuais menores, desde que preserve o
  comportamento atual.
- Nenhuma nova server function é introduzida por esta spec.

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   | a tela está em desktop e o usuário inicia edição | manter o conteúdo da questão visível na coluna principal e abrir o formulário na lateral |
| 2   | a tela está em mobile e o usuário inicia edição | empilhar o formulário sem esconder permanentemente o conteúdo principal |
| 3   | a questão tem draft pendente | manter as ações de aprovar/descartar acessíveis sem depender de expansão ou accordion |
| 4   | a questão é a primeira ou a última do exame | preservar os estados desabilitados de navegação, mas sem reduzir o destaque visual da toolbar |
| 5   | o enunciado ou as alternativas são longos | evitar que toolbar, ações e conteúdo se sobreponham ou causem quebras visuais incoerentes |
| 6   | o usuário cancela a edição | voltar ao estado compacto do painel lateral sem perder a visualização principal da questão |

## Questões em aberto

Sem questões em aberto no escopo desta spec.

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/features/exams
npm run docs-check
```

## Revisão humana

- Clareza da hierarquia visual entre toolbar, conteúdo principal e painel lateral.
- Ergonomia da edição em desktop, especialmente em larguras intermediárias.
- Legibilidade do destaque das alternativas corretas e do bloco de melhoria pendente.

## Verificação

```text
(preencher no fechamento)
```
