---
status: draft
date: 2026-06-25
builds-on: [ADR-0007, ADR-0008, ADR-0009, SPEC-0011, SPEC-0021]
implemented-by: []
---

# Agente opcional de explicações no job de melhoria de questões

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Permitir que o usuário ative, por execução, um agente especialista em explicações
dentro do job **Melhorar questões**. Quando ativado, cada questão melhorada passa
por um segundo agente no mesmo job, após o draft de melhoria ser criado. Esse
agente pode sobrescrever apenas `explanation` e `deepExplanation` do draft e
registrar alertas quando encontrar inconsistências, como um gabarito possivelmente
incorreto.

## Fluxo

1. O usuário abre o diálogo **Melhorar questões** em `/exams/$examId`.
2. O diálogo exibe um switch **Reescrever explicações com agente especialista**,
   desativado por padrão.
3. Ao iniciar o job, o client envia `writeExplanations` junto com `examId`,
   `questionIds` e `concurrencyLimit`.
4. A API valida o payload, cria o job `improve-questions` e persiste
   `writeExplanations` na metadata.
5. Para cada questão, o agente de melhoria atual roda primeiro e persiste um draft
   pendente completo.
6. Se `writeExplanations === false`, o fluxo termina como hoje.
7. Se `writeExplanations === true`, o mesmo worker roda um segundo agente para a
   mesma questão antes de marcar o item como concluído.
8. O agente de explicações lista a questão/draft atual, pode consultar a web e
   sobrescreve `explanation` e `deepExplanation` no draft.
9. O agente finaliza com resumo e alertas opcionais. Alertas são exibidos no
   monitor do job e ficam registrados no histórico de eventos.
10. O usuário revisa e aprova ou descarta o draft final na página da prova.

## Contrato

### UI

- `ExamImproveQuestionsDialog` adiciona um switch:
  - label: **Reescrever explicações com agente especialista**;
  - default: `false`;
  - envia `writeExplanations` no submit.
- `useImproveQuestionsJob.submit` e `createImproveQuestionsJob` aceitam:

```ts
type CreateImproveQuestionsJobInput = {
  examId: string;
  questionIds: string[];
  concurrencyLimit?: number;
  writeExplanations?: boolean;
};
```

### API e metadata

- `createImproveQuestionsJobSchema` aceita `writeExplanations?: boolean`.
- `ImproveQuestionsJobMetadata` inclui:

```ts
type ImproveQuestionsJobMetadata = {
  // campos existentes
  writeExplanations: boolean;
};
```

- Jobs antigos ou metadata sem o campo devem ser interpretados como
  `writeExplanations: false`.

### Estágios e eventos

- `ImproveQuestionStage` adiciona:

```ts
WRITING_EXPLANATIONS: "writing_explanations"
```

- O segundo agente usa os mesmos eventos de stream do job de melhoria:
  - `text`;
  - `tool-call`;
  - `tool-result`;
  - `data-improve-question-stage`;
  - `data-improve-question-warning`.
- Alertas do agente de explicações usam `buildImproveQuestionWarningEvent`.
- O item só recebe `data-improve-question-status: completed` depois que o segundo
  agente terminar, quando `writeExplanations === true`.

### Segundo agente

Novo runner:

```text
src/features/ai/jobs/improve-questions/run-improve-question-explanations-agent.ts
```

Responsabilidade:

- ler o draft pendente recém-criado para a questão;
- expor ferramentas restritas;
- sobrescrever apenas explicações;
- retornar resumo e alertas;
- nunca alterar enunciado, alternativas, gabarito, tópico ou modo de correção.

Ferramentas mínimas:

| Tool | Função |
| --- | --- |
| `list_question` | Retorna o snapshot original e o snapshot melhorado do draft atual. |
| `update_explanations` | Sobrescreve `explanation` e `deepExplanation` no draft pendente. |
| `finish_explanations` | Finaliza com resumo e alertas opcionais. |
| `web_search` | Disponível quando `TAVILY_API_KEY` existir. |
| `web_fetch` | Disponível quando `TAVILY_API_KEY` existir. |

Schemas:

```ts
type UpdateExplanationsInput = {
  questionId: string;
  explanation: string; // 1..10000
  deepExplanation: string; // 1..10000
};

type FinishExplanationsInput = {
  questionId: string;
  summary: string; // 1..400
  alerts?: string[]; // cada alerta 1..400
};
```

Regras:

- `list_question` só pode ler a questão atribuída ao agente.
- `update_explanations` só pode atualizar o draft pendente da questão atribuída.
- `update_explanations` preserva integralmente todos os campos do
  `improvedSnapshot`, exceto `explanation` e `deepExplanation`.
- `finish_explanations` só conclui depois de `list_question` e
  `update_explanations` terem sido chamados na execução atual.
- Caso o agente encontre possível erro de conteúdo, ele deve registrar alerta e
  ainda salvar as explicações quando possível.
- Alertas não mudam status do item para `failed`.

### Prompt

O prompt do agente de explicações deve reforçar:

- o agente atua após a melhoria da questão;
- ele deve escrever explicações em português;
- ele pode usar web quando precisar validar fato externo;
- ele pode indicar alerta quando houver possível inconsistência factual, gabarito
  incorreto ou alternativa ambígua;
- ele deve sobrescrever `explanation` e `deepExplanation`;
- ele não pode editar nenhum campo fora das explicações;
- ele deve usar as tools, sem responder com JSON solto.

### Persistência

- Não há nova tabela.
- `question_improvement_drafts.improved_snapshot` continua sendo a fonte do draft
  final.
- `question_improvement_drafts.metadata` pode registrar dados auxiliares do
  segundo agente, por exemplo:

```ts
type QuestionImprovementDraftMetadata = {
  explanations?: {
    summary: string | null;
    alerts: string[];
  };
};
```

- A aprovação do draft continua aplicando um único snapshot final em `questions`.

## Casos de borda

| # | QUANDO | o sistema DEVE |
| --- | --- | --- |
| 1 | `writeExplanations` ausente na metadata | tratar como `false` e manter fluxo atual |
| 2 | o primeiro agente falha antes de criar draft | não executar o agente de explicações e marcar o item como falho |
| 3 | `writeExplanations === true` e não existe draft pendente | marcar a questão como falha com erro claro |
| 4 | o agente de explicações alerta que o gabarito parece errado | salvar explicações, emitir warning e não alterar gabarito |
| 5 | Tavily não está configurado | executar sem `web_search`/`web_fetch`, mantendo as demais tools |
| 6 | `update_explanations` recebe outro `questionId` | rejeitar a tool call e manter o draft inalterado |
| 7 | `update_explanations` tenta enviar campos fora das explicações | ignorar/rejeitar pelo schema da tool e manter o draft inalterado |
| 8 | o agente não chama `finish_explanations` | falhar a etapa de explicações para a questão e registrar erro no item |
| 9 | o job é cancelado entre os dois agentes | não iniciar novas etapas e respeitar o cancelamento do batch |
| 10 | o segundo agente falha depois de sobrescrever explicações | manter o draft salvo até o último update bem-sucedido e marcar o item como falho |

## Questões em aberto

Nenhuma.

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run src/features/ai/jobs/improve-questions
npm test -- --run src/functions/jobs/create-improve-questions-job.test.ts
npm test -- --run src/features/exams/components/exam-improve-questions-dialog.spec.tsx
npm run docs-check                # exit 0
```

## Revisão humana

- Copy final do switch no diálogo.
- Legibilidade do estágio `writing_explanations` no monitor.
- Qualidade dos alertas emitidos quando o agente suspeitar de gabarito incorreto.

## Verificação

```text
Spec em draft; verificação de implementação será preenchida no fechamento.
```
