---
status: draft
date: 2026-06-30
builds-on: [ADR-0007, ADR-0008, ADR-0009, SPEC-0021, SPEC-0024, SPEC-0029]
implemented-by: []
---

# Explicações por alternativa no job de melhoria de questões

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Permitir que o usuário ative, por execução do job **Melhorar questões**, a
geração de uma explicação textual por alternativa da questão — explicando por
que cada alternativa está correta ou incorreta naquele contexto. A explicação
é armazenada dentro do próprio JSON de `options`, junto com `key` e `text`.
Não há coluna extra no banco.

## Fluxo

1. O usuário abre o diálogo **Melhorar questões** em `/exams/$examId`.
2. O diálogo exibe um switch **Explicar alternativas incorretas**, desativado
   por padrão, independente do switch de "Reescrever explicações".
3. Ao iniciar o job, o client envia `writeOptionExplanations` junto com os
   demais parâmetros.
4. A API valida o payload, cria o job `improve-questions` e persiste
   `writeOptionExplanations` na metadata.
5. Para cada questão, o agente de melhoria principal executa normalmente.
6. Se `writeOptionExplanations === true`, o prompt do agente principal é
   estendido para que ele **também** gere `explanation` em cada item do array
   `options` do snapshot melhorado.
7. A tool `update_question_draft` já aceita `options` com schema estendido —
   o campo `explanation` opcional em cada option é aceito e ignorado se
   ausente.
8. O snapshot é persistido normalmente em `question_improvement_drafts`.
9. O snapshot original (`originalSnapshot`) preserva as options originais sem
   `explanation`.
10. Na página de revisão, o formulário de edição exibe cada `explanation` por
    alternativa como um textarea abaixo do texto da alternativa, com toggle
    de diff quando a option original já tinha explanation (caso raro).
11. Ao aprovar o draft, `applyQuestionImprovementDraft` persiste o snapshot
    completo — incluindo options com explanation — na tabela `questions`.

## Contrato

### Estrutura de dados

`QuestionOption` passa a incluir `explanation` opcional:

```ts
type QuestionOption = {
  key: string;          // "A".."Z"
  text: string;         // texto da alternativa
  explanation?: string | null; // ← novo: por que está correta/incorreta
};
```

- `QuestionImprovementSnapshot.options` estende para `QuestionOption[]`.
- `questionSnapshotSchema.options` no agente aceita `explanation` opcional.
- `questionOptionSchema` no formulário ganha `explanation?: z.string().trim().max(1000).optional().nullable()`.
- `parseQuestionRow` precisa estender `optionSchema` para incluir `explanation?: z.string().trim().max(1000).optional().nullable()` — caso contrário o Zod strip removeria o campo ao fazer o parse.

### UI — Dialog

Novo switch em `ExamImproveQuestionsDialog`, abaixo do switch existente:

| Propriedade | Valor |
|---|---|
| label | **Explicar alternativas incorretas** |
| description | Gera, para cada alternativa, uma explicação do porquê ela está incorreta (ou correta). |
| default | `false` |
| estado | `const [writeOptionExplanations, setWriteOptionExplanations] = useState(false)` |

O submit envia `writeOptionExplanations` no payload para
`useImproveQuestionsJob.submit()`.

### API e metadata

- `createImproveQuestionsJobSchema` aceita `writeOptionExplanations?: boolean`.
- `ImproveQuestionsJobMetadata` inclui:

```ts
type ImproveQuestionsJobMetadata = {
  // campos existentes
  writeExplanations: boolean;
  writeOptionExplanations: boolean; // ← novo
};
```

- Jobs antigos ou metadata sem o campo devem ser interpretados como
  `writeOptionExplanations: false`.

### Agente de melhoria (principal)

- `runImproveQuestionAgent` recebe `writeOptionExplanations?: boolean` em
  `input`.
- O schema da tool `update_question_draft` (`questionSnapshotSchema`) já tem
  `options` com objeto que aceita campos extras — adicionar `explanation`
  opcional ao schema.
- O `buildPrompt` é modificado para incluir instrução condicional: quando
  `writeOptionExplanations` for true, o agente DEVE preencher `explanation`
  em cada option explicando por que aquela alternativa está correta ou incorreta
  no contexto da questão.
- A instrução condicional é inserida ANTES da linha "Persist the final improved
  question by calling update_question_draft exactly once."
- O campo `explanation` de cada option tem limite de 1000 caracteres.

```ts
type OptionWithExplanation = {
  key: string;
  text: string;
  explanation?: string | null; // 1..1000 quando presente
};
```

### Formulário de edição/revisão

`QuestionEditForm` (`question-edit-form.tsx`):
- Para cada option no formulário, se a option tiver `explanation`, renderizar
  um textarea adicional label **"Explicação da alternativa {key}"** abaixo do
  textarea do texto.
- O textarea tem placeholder "Por que esta alternativa está correta/incorreta?"
- `ImprovementToggle` e `DiffToggle` funcionam para cada explanation de option,
  comparando `originalSnapshot.options[i].explanation` vs.
  `improvedSnapshot.options[i].explanation`.

`QuestionFieldDiff` (`question-field-diff.tsx`):
- Suporta diff de explanation por option, usando o mesmo padrão dos campos
  existentes.

### Persistência

- Não há coluna ou tabela nova.
- `options` em `questions` é um TEXT com JSON e continua sendo tratado como
  `QuestionOption[]` — o campo `explanation` é opcional e ignorado se ausente.
- `question_improvement_drafts.improvedSnapshot.options` armazena as options
  com `explanation` quando gerado.
- `question_improvement_drafts.originalSnapshot.options` preserva as options
  sem `explanation`.
- `applyQuestionImprovementDraft` persiste o snapshot completo, incluindo
  explanations nas options, na tabela `questions` — sem alteração na lógica.

### UI — Job monitor

- `ImproveQuestionStage` não ganha novo estágio — a geração de explanations
  por alternativa acontece **dentro** do estágio `drafting` do agente principal.
- O progresso visual no monitor não muda.

## Casos de borda

| # | QUANDO | o sistema DEVE |
| --- | --- | --- |
| 1 | `writeOptionExplanations` ausente na metadata | tratar como `false` e manter fluxo atual |
| 2 | `writeOptionExplanations === true` e o agente gera options sem explanation | aceitar o snapshot e persistir como está (campo ausente = null) |
| 3 | option original já tinha `explanation` | preservar no `originalSnapshot`; o diff na revisão compara original vs. melhorado |
| 4 | apenas algumas alternatives têm explanation gerada | aceitar campo ausente nas demais como null |
| 5 | explanation excede 1000 caracteres | truncar no schema da tool e registrar warning no evento |
| 6 | usuário desativa o switch no meio do job | não afeta — a decisão é por job, não por questão |

## Questões em aberto

Nenhuma.

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run src/features/ai/jobs/improve-questions
npm test -- --run src/features/exams/components/exam-improve-questions-dialog.spec.tsx
npm test -- --run src/features/exams/components/question-edit-form.spec.tsx
npm run docs-check                # exit 0
```

## Revisão humana

- Copy do novo switch no diálogo.
- Layout do textarea de explanation por alternativa no formulário de edição.
- Qualidade da explicação gerada pelo agente (teste manual com uma questão real).

## Verificação

```text
Spec em draft; verificação de implementação será preenchida no fechamento.
```
