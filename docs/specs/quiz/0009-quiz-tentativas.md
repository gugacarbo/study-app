---
status: implemented
date: 2026-06-23
builds-on: [SPEC-0001, SPEC-0008, ADR-0003, ADR-0004]
implemented-by:
  - src/db/schema/exams.ts
  - migrations/0005_lively_gambit.sql
  - src/db/queries/attempts.ts
  - src/db/queries/attempts.test.ts
  - src/functions/quiz/start-attempt.ts
  - src/functions/quiz/start-attempt.test.ts
  - src/functions/quiz/get-active-attempt.ts
  - src/functions/quiz/get-active-attempt.test.ts
  - src/functions/quiz/submit-answer.ts
  - src/functions/quiz/submit-answer.test.ts
  - src/functions/quiz/finish-attempt.ts
  - src/functions/quiz/finish-attempt.test.ts
  - src/functions/quiz/get-attempt-result.ts
  - src/functions/quiz/get-attempt-result.test.ts
  - src/functions/quiz/list-exam-topics.ts
  - src/functions/quiz/list-exam-topics.test.ts
  - src/functions/quiz/quiz-helpers.ts
  - src/functions/quiz/quiz-helpers.test.ts
  - src/functions/quiz/quiz-types.ts
  - src/features/quiz/types/quiz.ts
  - src/features/quiz/hooks/use-active-attempt.ts
  - src/features/quiz/hooks/use-start-attempt.ts
  - src/features/quiz/hooks/use-submit-answer.ts
  - src/features/quiz/hooks/use-finish-attempt.ts
  - src/features/quiz/hooks/use-attempt-result.ts
  - src/features/quiz/hooks/use-topics-by-exam.ts
  - src/features/quiz/components/quiz-config-form.tsx
  - src/features/quiz/components/quiz-config-form.spec.tsx
  - src/features/quiz/components/quiz-question-card.tsx
  - src/features/quiz/components/quiz-navigation.tsx
  - src/features/quiz/components/quiz-result-summary.tsx
  - src/features/quiz/components/quiz-answer-review.tsx
  - src/features/quiz/pages/quiz-config-page.tsx
  - src/features/quiz/pages/quiz-session-page.tsx
  - src/features/quiz/pages/quiz-result-page.tsx
  - src/routes/_app/exams/$examId/quiz/index.tsx
  - src/routes/_app/exams/$examId/quiz/$attemptId/index.tsx
  - src/routes/_app/exams/$examId/quiz/$attemptId/result.tsx
  - src/features/exams/components/exam-detail-actions.tsx
  - src/features/exams/pages/exam-detail-page.spec.tsx
---

# Quiz: tentativas de resposta por exame

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Schema: SPEC-0001 (`attempts`, `attempt_answers`, `questions`, `exams`).
> Catálogo de exames: SPEC-0008. Autorização/sessão: ADR-0003, ADR-0004.

## Objetivo

Usuário autenticado inicia uma tentativa de quiz a partir de uma prova, configura quantidade, ordem, tópico e modo de revelação de gabarito, responde as questões uma por vez com persistência parcial, finaliza a tentativa e visualiza o resultado com gabarito e explicação. Uma única tentativa ativa (`in_progress`) é permitida por usuário/prova.

## Fluxo

1. **Detalhe da prova** (`/exams/$examId`)
   - Botão principal "Fazer quiz".
   - Dropdown rápido com as mesmas opções da tela de configuração usando defaults (todas as questões, ordem original, todos os tópicos, modo `after`).
   - Clicar em "Iniciar" cria a tentativa e navega para `/exams/$examId/quiz/$attemptId`.
   - Se já existir tentativa ativa para esse usuário/prova, navega diretamente para ela.

2. **Configuração pré-quiz** (`/exams/$examId/quiz`)
   - Tela dedicada para ajustar:
     - Quantidade de questões (máximo = disponível após filtro de tópico).
     - Ordem: `original` ou `random`.
     - Filtro por tópico (select com os tópicos existentes da prova + "Todos").
     - Modo de revelação: `during` (mostra gabarito/explicação ao responder) ou `after` (só no final).
   - Botão "Iniciar tentativa".

3. **Sessão do quiz** (`/exams/$examId/quiz/$attemptId`)
   - Carrega a tentativa e as questões na ordem/config escolhida.
   - Mostra uma questão por vez.
   - Alternativas com checkbox/radio conforme o tipo da questão (múltipla escolha tradicional ou múltiplas corretas).
   - Ao marcar/desmarcar, `submitAnswer` persiste a resposta imediatamente.
   - Modo `during`: após responder, revela se acertou e a explicação.
   - Modo `after`: não revela durante a sessão.
   - Navegação anterior/próxima disponível.
   - Botão "Finalizar" acessível a qualquer momento.

4. **Resultado** (`/exams/$examId/quiz/$attemptId/result`)
   - Mostra percentual geral, total de questões respondidas e acertos ponderados.
   - Lista as questões com resposta do usuário, gabarito e explicação (`questions.explanation`).
   - Botão "Nova tentativa" (cria outra após finalizar/completar a atual).

## Contrato

### Schema — alterações

Nova coluna em `attempts`:

| Coluna | Tipo | Default | Descrição |
| --- | --- | --- | --- |
| `user_id` | `text` | — | FK `user.id` com `ON DELETE CASCADE` |
| `config` | `text` | `'{}'` | JSON com `{ order, quantity, topicFilter, revealMode }` |

`attempts` possui `user_id` com FK para `user.id`. O isolamento primário é feito diretamente na tabela de tentativas; a verificação de propriedade da prova ainda é obrigatória via `exams.user_id` para evitar tentativas órfãs.

### Server functions

| Server function | Método | Input | Output |
| --- | --- | --- | --- |
| `startQuizAttempt` | POST | `{ examId, order?, quantity?, topicFilter?, revealMode? }` | `Attempt` |
| `getActiveAttempt` | GET | `{ examId }` | `{ attempt, questions }` ou `null` |
| `submitAnswer` | POST | `{ attemptId, questionId, selectedOptions: string[] }` | `AttemptAnswer` |
| `finishAttempt` | POST | `{ attemptId }` | `AttemptResult` |
| `getAttemptResult` | GET | `{ attemptId }` | `AttemptResult` |
| `listExamTopics` | GET | `{ examId }` | `string[]` |

### Tipos/Contratos

```ts
type QuizConfig = {
  order: 'original' | 'random';
  quantity: number; // 0 = todas
  topicFilter: string | null;
  revealMode: 'during' | 'after';
};

type Attempt = {
  id: string;
  examId: string;
  config: QuizConfig;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  status: 'in_progress' | 'completed';
  startedAt: string;
};

type AttemptResult = Attempt & {
  scorePercent: number;
  questions: Array<{
    questionId: string;
    question: string;
    options: Array<{ id: string; text: string }>;
    correctOptionIds: string[];
    selectedOptionIds: string[];
    credit: number;
    explanation: string | null;
  }>;
};
```

### Pontuação

Crédito parcial proporcional simples para cada questão:

```
correctMarked = |selected ∩ correct|
incorrectMarked = |selected - correct|
credit = max(0, correctMarked / |correct| - incorrectMarked / |correct|)
```

A nota final é a soma dos créditos dividida pelo número de questões da tentativa, convertida em percentual.

### Rotas

| Rota | Componente |
| --- | --- |
| `/exams/$examId` | adicionar CTA de quiz (já existente, placeholder em SPEC-0008) |
| `/exams/$examId/quiz` | `quiz-config-page.tsx` |
| `/exams/$examId/quiz/$attemptId` | `quiz-session-page.tsx` |
| `/exams/$examId/quiz/$attemptId/result` | `quiz-result-page.tsx` |

## Casos de borda

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | --- | --- |
| 1 | o usuário solicitar quiz de uma prova que não existe ou não pertence a ele | retornar 404 |
| 2 | a prova não tiver questões suficientes após o filtro | mostrar aviso na tela de configuração e bloquear início |
| 3 | já houver uma tentativa `in_progress` para o usuário/prova | redirecionar para `/exams/$examId/quiz/$attemptId` |
| 4 | a questão já tiver sido respondida anteriormente | carregar as alternativas selecionadas salvas |
| 5 | uma tentativa `completed` for acessada via rota de sessão | redirecionar para a rota de resultado |
| 6 | o usuário tentar acessar uma tentativa de outro usuário | retornar 404 |
| 7 | nenhuma alternativa for marcada ao avançar | permitir avançar sem responder; `answeredQuestions` só conta questões com resposta |
| 8 | `quantity` for maior que o disponível após filtro | limitar ao disponível no backend |
| 9 | `order = random` | usar seed determinística salva em `config` para que recarregamentos mantenham a ordem |
| 10 | `submitAnswer` receber `questionId` fora da tentativa | rejeitar com 422 |

## Questões em aberto

- [ ] Modo de quiz "simulado" com tempo limite.
- [ ] Revisão de erros separada do resultado completo.
- [ ] Pontuação com pesos por tópico.
- [ ] Compartilhamento de resultado.

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run                 # tudo verde (incluir novos testes de quiz)
npm run docs-check                # exit 0
```

## Revisão humana

- Validar se a fórmula de crédito parcial reflete o comportamento esperado para provas do domínio (exames universitários IFSC).
- Revisar UX da tela de configuração pré-quiz.

## Verificação

```text
npm run typecheck                 # exit 0
npm test                          # 95 files, 482 tests passed
npm run docs-check                # exit 0
```

<!-- Checklist de fechamento:
- [ ] DoD verde, evidência acima
- [ ] status: implemented + implemented-by com paths reais
- [ ] gotchas novos → AGENTS.md
- [ ] npm run docs-check -- --emit-index
-->
