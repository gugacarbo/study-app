# Task-C-001 Report — Exibir explanations por alternativa no formulário de edição/revisão

## 1. O que foi implementado

- Adicionado `optionExplanations: false` ao estado `visibleDiffs` para controlar a exibição de diffs de explanation por alternativa
- Adicionados `hasOptionExplanationChanges` e `isOptionExplanationBase` (computed values) para detectar mudanças entre base e improved e identificar se o form está exibindo a versão base
- Adicionada função `toggleOptionExplanations` que alterna todas as explanations das options entre base e improved via `replace` do `useFieldArray`
- Adicionados `ImprovementToggle` e `DiffToggle` para `optionExplanations` na seção de Alternativas (após os toggles existentes de options)
- Adicionado textarea de explanation dentro de cada option (dentro do `flex-1` div, após o Input de texto) — renderizado condicionalmente apenas quando `option.explanation` existe
- Adicionado `QuestionFieldDiff` abaixo do textarea de explanation, exibido quando `visibleDiffs.optionExplanations` é true e `baseQuestion` está presente

## 2. Testes executados e resultados

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ exit 0, sem erros |
| `npm test -- --run src/features/exams/components/question-edit-form.spec.tsx` | 17 passed, 2 failed — mesmas 2 falhas pré-existentes (não relacionadas) |
| `npm test -- --run` (full suite) | 119 passed, 5 failed — mesmas 5 falhas pré-existentes em `run-ingest.test.ts` (D1 mock) |

## 3. Arquivos modificados

Apenas `src/features/exams/components/question-edit-form.tsx`

## 4. Self-review findings

- O padrão segue exatamente o existente para `explanation`/`deepExplanation` (mesma estrutura de `visibleDiffs`, `ImprovementToggle`, `DiffToggle`, `QuestionFieldDiff`)
- A renderização condicional `{option.explanation ? (...)}` garante que apenas options com explanation gerada exibam o textarea, conforme spec
- O `QuestionFieldDiff` usa `find` por key para matching entre base e improved (mais robusto que índice posicional)
- O toggle `toggleOptionExplanations` usa `replace` do `useFieldArray` para atualizar todas as explanations dos fields registrados

## 5. Issues ou concerns

- O textarea de explanation só aparece se `option.explanation` existe — options sem explanation não exibem o campo. Isso é deliberado (spec: "Only render this if option.explanation exists"). Se no futuro quiser-se permitir adicionar explanation manualmente, será necessário alterar a condição
- As 2 falhas no teste `"keeps diff visibility independent between fields"` são pré-existentes (confirmado via `git stash` + run no `main` limpo)
