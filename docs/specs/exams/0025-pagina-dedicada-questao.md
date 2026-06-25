---
status: draft
date: 2026-06-25
builds-on: [SPEC-0008, SPEC-0021, SPEC-0024]
implemented-by: []
---

# Lista enxuta de questões no exame e página dedicada por questão

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Separar navegação e leitura no detalhe da prova:

1. `/exams/$examId` passa a ser uma página de contexto do exame com lista escaneável de
   questões, sem expandir o conteúdo completo de cada uma.
2. Cada questão ganha uma rota dedicada para estudo e edição:
   `/exams/$examId/questions/$questionId`.
3. A página dedicada preserva o comportamento já existente de visualização, edição inline e
   tratamento de melhoria pendente, adicionando navegação entre questão anterior e próxima.

Esta spec substitui o accordion de visualização de questões descrito em SPEC-0008 e move o
comportamento detalhado de SPEC-0021 para a nova rota por questão.

## Fluxo

### Página do exame (`/exams/$examId`)

1. O usuário abre `/exams/$examId`.
2. A página carrega `getExam({ examId })` como já faz hoje.
3. Header e ações do exame permanecem visíveis.
4. A área de questões renderiza uma lista clicável.
5. Cada item mostra:
   - `Q{n} · {topic ?? "Geral"}`;
   - trecho curto do enunciado;
   - indicador de status quando houver melhoria pendente.
6. Ao clicar no item, o usuário navega para `/exams/$examId/questions/$questionId`.

### Página da questão (`/exams/$examId/questions/$questionId`)

1. O usuário chega pela lista do exame ou diretamente pela URL.
2. A página carrega o exame pelo mesmo `examId` e seleciona a questão pelo `questionId`.
3. A UI mostra:
   - ação de voltar para `/exams/$examId`;
   - identificação da posição da questão no exame (`Q{n} de {total}`);
   - botões para questão anterior e próxima, conforme disponibilidade;
   - conteúdo completo da questão.
4. O conteúdo completo preserva:
   - enunciado;
   - alternativas com destaque das corretas;
   - edição inline;
   - bloco de melhoria pendente com aprovar/descartar.
5. Ao salvar edição, a própria página dedicada continua aberta com os dados atualizados.
6. Se o usuário navegar para anterior/próxima, a página troca apenas a questão alvo dentro do
   mesmo exame.

## Contrato

### Rotas

| URL | Arquivo | Responsabilidade |
| --- | ------- | ---------------- |
| `/exams/$examId` | `src/routes/_app/exams/$examId/index.tsx` | Hub do exame com lista de questões |
| `/exams/$examId/questions/$questionId` | `src/routes/_app/exams/$examId/questions/$questionId/index.tsx` | Detalhe completo de uma questão |

### Fonte de dados

- `getExam({ examId })` permanece a fonte de verdade para `ExamDetail`.
- A página dedicada da questão não cria uma segunda server function específica para leitura de
  uma única questão nesta primeira versão.
- A seleção da questão acontece no client por `questionId` a partir de `exam.questions`.
- O mapa `draftsByQuestionId` continua alimentando o estado de melhoria pendente.

### UI do exame

`ExamQuestionList` deixa de renderizar accordion e passa a renderizar uma lista vertical de itens
clicáveis.

Cada item DEVE conter:

- título `Q{n} · {topic ?? "Geral"}`;
- preview textual do enunciado com truncamento;
- badge ou texto curto de status para `Melhoria pendente`, quando existir;
- affordance clara de navegação.

Cada item NÃO DEVE conter:

- alternativas;
- gabarito;
- formulário de edição;
- comparação completa entre original e melhorada.

### UI da página dedicada

Um novo componente de detalhe por questão reaproveita a estrutura já existente de
`ExamQuestionItem`, mas fora do accordion.

Ele DEVE renderizar:

- toolbar superior com voltar, posição atual e navegação anterior/próxima;
- bloco de melhoria pendente, quando existir;
- enunciado completo;
- alternativas;
- botão `Editar pergunta`;
- `QuestionEditForm` quando `isEditing === true`.

Regras de navegação:

- `Questão anterior` fica desabilitado na primeira questão.
- `Próxima questão` fica desabilitado na última questão.
- A navegação usa rota real, mudando `questionId` na URL.
- O botão de voltar sempre leva para `/exams/$examId`.

### Reaproveitamento e composição

- `ExamDetailPage` continua responsável por header + actions + lista.
- O conteúdo rico atual da questão deve ser extraído para um componente reutilizável de detalhe,
  consumido pela nova página dedicada.
- A lista do exame passa a ter um item compacto próprio, separado do detalhe.
- `useUpdateQuestion` e `useQuestionImprovementDraftActions` permanecem como contratos de mutação.

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   | o exame não tem questões | renderizar header + ações + mensagem de lista vazia em `/exams/$examId` |
| 2   | o usuário acessa `/exams/$examId/questions/$questionId` com `examId` inexistente ou de outro user | responder 404 pelo mesmo fluxo já usado em `getExam` |
| 3   | o exame existe, mas `questionId` não pertence a ele | renderizar 404 na página dedicada |
| 4   | a questão aberta é a primeira | desabilitar `Questão anterior` |
| 5   | a questão aberta é a última | desabilitar `Próxima questão` |
| 6   | a questão tem `topic = null` | exibir `Geral` tanto na lista quanto no detalhe |
| 7   | existe draft de melhoria para a questão | exibir indicador resumido na lista e bloco completo no detalhe |
| 8   | o usuário salva edição na página dedicada | manter a rota atual e refletir os dados atualizados |
| 9   | o usuário abre a página dedicada direto pela URL | conseguir estudar/editar normalmente sem depender de estado de navegação prévio |

## Questões em aberto

Sem questões em aberto no escopo desta spec.

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/features/exams
npm run docs-check
```

## Revisão humana

- Densidade visual da lista de questões no exame em mobile e desktop.
- Clareza dos botões de anterior/próxima na página dedicada.
- Confirmação de que a navegação entre questões não passa sensação de "perda de contexto".

## Verificação

```text
(preencher no fechamento)
```
