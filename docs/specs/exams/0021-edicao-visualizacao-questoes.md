---
status: implemented
date: 2026-06-22
builds-on: [SPEC-0008]
implemented-by: [2026-06-22]
---

# Edição inline e visualização aprimorada de questões no detalhe da prova

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Permitir que o usuário edite questões diretamente na página `/exams/$examId`, sem sair do contexto de revisão da prova. A visualização da questão passa a mostrar a resposta correta de forma permanente e a enumerar as alternativas em letras minúsculas (`a`, `b`, `c`…).

## Fluxo

1. O usuário abre `/exams/$examId`.
2. Cada questão aparece como item expansível do accordion, com rótulo `Q{n} · {tópico}`.
3. Ao expandir, o usuário vê:
   - enunciado;
   - alternativas enumeradas em minúsculas (`a)`, `b)`, `c)`…);
   - resposta correta destacada logo abaixo das alternativas;
   - botão secundário **Editar pergunta**.
4. Ao clicar em **Editar pergunta**, o conteúdo expandido vira um formulário com todos os campos editáveis.
5. O usuário altera os campos, incluindo adicionar/remover alternativas e marcar a(s) correta(s).
6. Ao clicar em **Salvar**, o sistema envia a atualização para o servidor, persiste em D1 e volta ao modo de visualização com os dados atualizados.
7. Ao clicar em **Cancelar**, o formulário descarta as alterações locais e volta ao modo de visualização.

## Contrato

### UI

- `ExamQuestionItem` ganha estado local `isEditing: boolean`.
- Quando `isEditing === true`, renderiza `QuestionEditForm` no lugar do conteúdo de visualização.
- Visualização:
  - Alternativas sempre exibidas com letras minúsculas via `option.key.toLowerCase()`.
  - Resposta correta sempre visível, destacada em bloco `Gabarito`.
- Formulário:
  - Campos: `question`, `topic`, `scoringMode`, `explanation`, `deepExplanation`, e lista dinâmica de `options`.
  - Cada alternativa tem input de texto e checkbox para marcar se é correta.
  - Botões para adicionar/remover alternativas; reordenação não é obrigatória.
  - Select `scoringMode` com opções `exact` e `partial`.
  - Botões **Salvar** e **Cancelar**.

### Validação (Zod)

- `question`: string não vazia, máx. 5000 caracteres.
- `topic`: string opcional, máx. 200 caracteres.
- `scoringMode`: literal `exact` | `partial`.
- `options`: array de 2 a 10 objetos `{ key: string, text: string }`.
  - `key`: letra maiúscula única gerada automaticamente (`A`, `B`, `C`…).
  - `text`: string não vazia, máx. 1000 caracteres.
- `answers`: array não vazio de `key`s existentes em `options`.
  - `scoringMode === "exact"`: exatamente 1 elemento.
  - `scoringMode === "partial"`: 1 a `options.length` elementos.
- `explanation` e `deepExplanation`: strings opcionais, máx. 10000 caracteres.

### Server function

- Nova `src/functions/exams/update-question.ts`.
- `updateQuestion(input)` recebe `examId`, `questionId` e os campos editáveis.
- `requireSession` + join com `exams` filtrando `user_id`; questão de outro usuário → **404**.
- Atualiza a linha em `questions` somente se pertencer ao exame do usuário.
- Retorna a questão atualizada no formato `QuestionDetail`.

### Hook

- Novo `src/features/exams/hooks/use-update-question.ts`.
- Mutation via TanStack Query.
- On success: invalida a query `exam` para `examId` e alterna `isEditing` de volta para `false`.

## Casos de borda

| #   | QUANDO ⟨gatilho⟩                                                                 | o sistema DEVE ⟨resposta⟩                                      |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | a questão tem apenas 2 alternativas e o usuário tenta remover uma              | manter no mínimo 2 alternativas (botão desabilitado)             |
| 2   | o usuário remove uma alternativa que estava marcada como correta                 | desmarcá-la e, se `answers` ficar vazio, exigir nova seleção       |
| 3   | `scoringMode` é alterado de `partial` para `exact` e várias alternativas estão marcadas | manter apenas a primeira marcação e limpar as demais             |
| 4   | o usuário tenta salvar sem nenhuma alternativa correta marcada                 | exibir erro de validação no campo de gabarito                    |
| 5   | o servidor retornar 404 ao salvar                                              | mostrar mensagem genérica de erro e manter o formulário aberto   |
| 6   | o usuário cancela a edição                                                       | descartar alterações locais sem chamar o servidor                |
| 7   | duas alternativas ficam com texto vazio                                        | impedir envio e sinalizar os campos inválidos                    |

## Questões em aberto

- [ ]

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run                 # N/N verdes
npm run docs-check                # exit 0
```

## Revisão humana

- Alinhamento visual do destaque da resposta correta (badge vs. bloco).
- Limite máximo de alternativas (10) e caracteres dos campos.

## Verificação

```text
typecheck: exit 0
tests: 14 passed (exam-question-item.spec.tsx + question-edit-form.spec.tsx)
docs-check: exit 0 (após preenchimento)
comportamento verificado: accordion expandível, gabarito visível, edição inline com formulário, validação Zod, adição/remoção de alternativas, toggle scoringMode
```
