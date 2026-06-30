---
status: draft
date: 2026-06-29
builds-on: [SPEC-0024, SPEC-0025, SPEC-0027]
implemented-by: []
---

# CTA de revisar melhoria na visualização da prova

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Trocar a ação principal de melhoria na página `/exams/$examId` quando a prova já tiver
melhorias pendentes de aprovação.

Quando não existir draft pendente, a tela continua oferecendo o fluxo atual para iniciar um
novo lote de melhoria. Quando existir ao menos um draft pendente, a tela passa a priorizar a
revisão desse trabalho, escondendo a ação de iniciar nova melhoria e oferecendo um atalho
direto para a primeira questão pendente.

## Fluxo

1. O usuário abre `/exams/$examId`.
2. A página carrega as questões do exame e os drafts pendentes por
   `useQuestionImprovementDrafts(examId)`.
3. Se não existir draft pendente, a área de ações continua exibindo `Melhorar`, que abre o
   dialog atual para iniciar um novo lote.
4. Se existir ao menos um draft pendente, `Melhorar` desaparece e a área de ações passa a
   exibir `Revisar melhoria`.
5. Ao clicar em `Revisar melhoria`, o usuário navega para
   `/exams/$examId/questions/$questionId`, usando a primeira questão pendente como destino.
6. Na página dedicada da questão, o usuário continua usando o fluxo já existente de revisar,
   aprovar ou descartar a melhoria.
7. Quando todas as pendências forem resolvidas, a página da prova volta a exibir `Melhorar`.

## Contrato

### Fonte de verdade

- `useQuestionImprovementDrafts(examId)` continua sendo a fonte de verdade para detectar se a
  prova tem melhorias pendentes.
- O estado `tem pendência` é derivado de `drafts.length > 0`.
- O destino de `Revisar melhoria` é derivado do primeiro draft retornado para a prova.

### UI da página da prova

Na área de ações de `/exams/$examId`, a UI DEVE obedecer às seguintes regras:

- sem drafts pendentes: exibir o botão `Melhorar`;
- com drafts pendentes: exibir o botão `Revisar melhoria`;
- com drafts pendentes: esconder totalmente a ação de iniciar nova melhoria nessa tela;
- com drafts pendentes: usar `Revisar melhoria` como ação principal relacionada ao fluxo de
  melhoria.

Esta spec não cria um novo dialog, painel ou rota de aprovação. A revisão continua acontecendo
na rota dedicada da questão já existente.

### Navegação

- `Revisar melhoria` DEVE navegar para `/exams/$examId/questions/$questionId`.
- O `questionId` DEVE ser o da primeira questão com draft pendente no conjunto retornado para a
  prova.
- A navegação DEVE reaproveitar a página dedicada da questão como superfície de aprovação.

### Escopo

- Esta spec altera apenas a entrada do fluxo a partir da visualização da prova.
- O comportamento interno de aprovar, descartar e renderizar snapshots na página da questão não
  muda.
- O dialog `Melhorar` atual permanece disponível apenas quando não houver draft pendente.

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   | a prova não tem questões | manter a ausência das ações de melhoria como já ocorre hoje |
| 2   | a prova tem questões e nenhum draft pendente | exibir `Melhorar` e permitir abrir o dialog de novo lote |
| 3   | a prova tem uma ou mais questões com draft pendente | exibir `Revisar melhoria` no lugar de `Melhorar` |
| 4   | existem múltiplos drafts pendentes | navegar sempre para a primeira questão do conjunto retornado ao clicar em `Revisar melhoria` |
| 5   | a última pendência da prova é aprovada ou descartada | voltar a exibir `Melhorar` na visualização da prova após a atualização dos drafts |
| 6   | existe draft pendente | não exibir nenhum atalho para iniciar novo lote de melhoria na visualização da prova |
| 7   | o draft usado como destino deixa de existir entre o carregamento e o clique | reutilizar o comportamento já existente da rota de questão para destino inválido, sem tratamento especial novo nesta spec |

## Questões em aberto

Sem questões em aberto no escopo desta spec.

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/features/exams/pages/exam-detail-page.spec.tsx
npm run docs-check
```

## Revisão humana

- Confirmar se `Revisar melhoria` comunica claramente que o destino será a primeira questão
  pendente, não uma lista intermediária.
- Validar se a ausência total de `Melhorar` durante pendência não causa sensação de bloqueio
  indevido para o fluxo esperado.

## Verificação

```text
(preencher no fechamento)
```
