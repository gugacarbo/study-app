---
status: implemented
date: 2026-06-19
builds-on: [SPEC-0001, SPEC-0004, SPEC-0005, SPEC-0014]
implemented-by:
  - src/components/ui/collapsible.tsx
  - src/db/queries/exams.ts
  - src/db/queries/exams.test.ts
  - src/db/queries/questions.ts
  - src/features/background-processes/pages/job-monitor-page.tsx
  - src/features/background-processes/pages/job-monitor-page.spec.tsx
  - src/features/exams/components/exam-detail-actions.tsx
  - src/features/exams/components/exam-detail-header.tsx
  - src/features/exams/components/exam-question-item.tsx
  - src/features/exams/components/exam-question-item.spec.tsx
  - src/features/exams/components/exam-question-list.tsx
  - src/features/exams/components/exams-list.tsx
  - src/features/exams/components/exams-list.spec.tsx
  - src/features/exams/hooks/use-exam.ts
  - src/features/exams/hooks/use-exams.ts
  - src/features/exams/lib/parse-question-fields.ts
  - src/features/exams/lib/parse-question-fields.test.ts
  - src/features/exams/pages/exam-detail-page.tsx
  - src/features/exams/pages/exam-detail-page.spec.tsx
  - src/features/exams/pages/exams-page.tsx
  - src/features/exams/types/exam-detail.ts
  - src/functions/exams/get-exam.ts
  - src/functions/exams/get-exam.test.ts
  - src/functions/exams/list-exams.ts
  - src/functions/exams/list-exams.test.ts
  - src/routes/_app/exams/$examId/index.tsx
  - src/routes/_app/exams/index.tsx
  - src/routeTree.gen.ts
---

# Catálogo de exames: listagem e detalhe de provas

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Questões persistidas pelo ingest
> (SPEC-0004) alimentam este catálogo. Schema: SPEC-0001 (`exams`, `questions`). Shell e nav:
> SPEC-0005. Pós-ingest e botão "Ver prova": SPEC-0014.

## Objetivo

Usuário autenticado:

1. **Lista** provas importadas em `/exams` (nome, contagem de questões, origem, data).
2. **Abre detalhe** em `/exams/$examId` — hub de estudo com metadados, CTAs futuros (quiz /
   explicações) e revisão das questões extraídas.
3. **Navega** da listagem ou do monitor de ingest concluído para o detalhe do exame.

Quiz (SPEC-0009) e explicações (SPEC-0011) ficam fora desta spec — apenas CTAs placeholder.

## Fluxo

### Listagem (`/exams`)

1. Usuário autenticado acessa `/exams`.
2. Client chama `listExams` (server function GET) → `listExamsByUserId`.
3. UI renderiza cards ordenados por `created_at` desc (via query).
4. Lista vazia → empty state com CTA "Importar prova" → `/exams/new`.
5. Clique em card → `navigate({ to: "/exams/$examId", params: { examId } })`.

### Detalhe / hub (`/exams/$examId`)

1. Usuário abre `/exams/$examId` (listagem ou botão pós-ingest).
2. Client chama `getExam({ examId })` → `getExamWithQuestions`.
3. Página exibe header (nome, contagem, data), barra de CTAs desabilitados e lista de questões.
4. Cada questão: card colapsável — trigger `Q{n} · {topic}`; expandido mostra enunciado +
   alternativas.
5. Usuário clica "Revelar resposta" → gabarito aparece na mesma questão (estado local).
6. Exame inexistente ou de outro user → 404.

### Pós-ingest (SPEC-0014)

1. Job `ingest` termina com `status = completed` em `/jobs/$jobId`.
2. UI mostra botão primário **"Ver prova"** quando `metadata.examId` presente →
   `/exams/$examId`.
3. Botões secundários "Nova importação" e "Ver provas" permanecem.
4. **Sem** redirect automático para o detalhe.

## Contrato

### Rotas

| URL | Arquivo | Layout |
| --- | ------- | ------ |
| `/exams` | `src/routes/_app/exams/index.tsx` | Shell padrão (`max-w-4xl`) |
| `/exams/$examId` | `src/routes/_app/exams/$examId/index.tsx` | Shell padrão |

Título da shell (`getAppPageTitle`): **"Provas"** para `/exams` e `/exams/*` (exceto `/exams/new`).

### Módulo client

`src/features/exams/` — páginas, componentes e hooks de domínio.

| Componente | Path | Responsabilidade |
| ---------- | ---- | ---------------- |
| `ExamsPage` | `pages/exams-page.tsx` | Listagem com Suspense |
| `ExamsList` | `components/exams-list.tsx` | Cards clicáveis + empty state |
| `ExamDetailPage` | `pages/exam-detail-page.tsx` | Hub: header + actions + lista |
| `ExamDetailHeader` | `components/exam-detail-header.tsx` | Nome + meta (contagem + data) |
| `ExamDetailActions` | `components/exam-detail-actions.tsx` | CTAs disabled + "Em breve" |
| `ExamQuestionList` | `components/exam-question-list.tsx` | Lista numerada + empty state |
| `ExamQuestionItem` | `components/exam-question-item.tsx` | Collapsible + revelar gabarito |
| `useExams` | `hooks/use-exams.ts` | Query key `["exams"]` |
| `useExam` | `hooks/use-exam.ts` | Query key `["exams", examId]` |

UI primitiva: `Collapsible` shadcn (`src/components/ui/collapsible.tsx`).

### Server functions

| Function | Método | Input | Output |
| -------- | ------ | ----- | ------ |
| `listExams` | GET | — | `ExamListItem[]` |
| `getExam` | GET | `{ examId: uuid }` | `ExamDetail` |

Handlers exportáveis (`listExamsHandler`, `getExamHandler`) para testes unitários.

**Autorização:** `requireSession`; filtrar por `user_id`. Exame de outro user →
`throw new Response("Not Found", { status: 404 })` (mesmo envelope que storage/admin).

### Queries D1

| Query | Arquivo | Regra |
| ----- | ------- | ----- |
| `listExamsByUserId` | `src/db/queries/exams.ts` | `LEFT JOIN questions`, `GROUP BY exam`, `ORDER BY created_at DESC` |
| `getExamById` | idem | `exam.id + user_id` |
| `listQuestionsByExam` | `src/db/queries/questions.ts` | `ORDER BY created_at` |
| `getExamWithQuestions` | `src/db/queries/exams.ts` | Compõe exame + questões parseadas; `null` se exame ausente |

### DTOs

```ts
type ExamListItem = {
  id: string
  name: string
  source: string | null
  createdAt: string | null
  questionCount: number
}

type QuestionOption = { key: string; text: string }

type QuestionDetail = {
  id: string
  question: string
  options: QuestionOption[]
  answers: string[]
  topic: string | null
  scoringMode: "exact" | "partial"
}

type ExamDetail = {
  id: string
  name: string
  createdAt: string | null
  questionCount: number
  questions: QuestionDetail[]
}
```

**Parse de colunas JSON** (`options`, `answers`): formato SPEC-0004. Helper puro
`parseQuestionRow` em `src/features/exams/lib/parse-question-fields.ts` — retorna `null` se JSON
inválido (questão omitida na resposta, `console.warn` no handler).

**Fora do DTO v1:** `explanation`, `deepExplanation`, `source` do exame no detalhe, blob/arquivo
original.

### Layout do detalhe (hub — opção A aprovada)

```
┌─────────────────────────────────┐
│ {nome do exame}                 │
│ {N} questões · {data pt-BR}     │
├─────────────────────────────────┤
│ [Iniciar quiz] [Explicações]    │  ← disabled + "Em breve"
├─────────────────────────────────┤
│ ▼ Q1 · Limites                  │
│ ▼ Q2 · Derivadas                │
│ ...                             │
└─────────────────────────────────┘
```

**Card expandido:**

- Enunciado (`question`)
- Alternativas: `{key}) {text}` — lista vertical, sem highlight de gabarito
- Botão ghost "Revelar resposta" → exibe texto(s) corretos (`key` + `text` para cada `answers[i]`)
- Suporta `scoringMode: partial` (múltiplas keys em `answers`)

**Trigger colapsado:** `Q{índice 1-based} · {topic ?? "Geral"}`.

### Integração job monitor

Em `JobMonitorPage`, bloco terminal `completed`:

| Botão | Variante | Destino | Condição |
| ----- | -------- | ------- | -------- |
| Ver prova | default/primary | `/exams/$examId` | `metadata?.examId` definido |
| Nova importação | outline | `/exams/new` | sempre |
| Ver provas | secondary | `/exams` | sempre |

## Casos de borda

| # | QUANDO | o sistema DEVE |
| --- | ------ | -------------- |
| 1 | usuário acessa `/exams` sem exames | empty state + CTA importar |
| 2 | usuário clica card na listagem | navegar SPA para `/exams/$examId` |
| 3 | `examId` inexistente ou de outro user em `getExam` | responder 404 |
| 4 | exame sem questões no detalhe | header + CTAs + mensagem "Nenhuma questão extraída ainda" |
| 5 | `options` ou `answers` com JSON inválido em uma questão | omitir questão; renderizar demais |
| 6 | `topic` null | exibir "Geral" no trigger |
| 7 | `answers` com múltiplas keys (`partial`) | gabarito revelado lista todas |
| 8 | job ingest `completed` com `metadata.examId` | exibir botão "Ver prova" |
| 9 | job ingest `completed` sem `metadata.examId` | ocultar botão "Ver prova" |
| 10 | usuário expande questão | mostrar enunciado + alternativas sem gabarito |
| 11 | usuário clica "Revelar resposta" | mostrar gabarito só naquela questão |
| 12 | CTAs quiz/explicações na v1 | permanecer `disabled` com indicação "Em breve" |

## Questões em aberto

- [ ] Edição/exclusão de exame e cascade (SPEC-0001) — fora da v1 desta spec
- [ ] Filtros, busca e ordenação na listagem — fora da v1
- [ ] Habilitar CTAs quando SPEC-0009 e SPEC-0011 forem implementadas

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run src/db/queries/exams src/functions/exams/get-exam src/functions/exams/list-exams
npm test -- --run src/features/exams
npm test -- --run src/features/background-processes/pages/job-monitor-page
npm run docs-check                # exit 0
```

Critérios:

- Listagem e detalhe navegáveis sem full reload.
- Detalhe: header, CTAs disabled, questões colapsáveis, revelar gabarito.
- Cross-user → 404.
- Job completed → "Ver prova" quando `examId` no metadata.
- `implemented-by` preenchido no fechamento.

## Revisão humana

- Fluxo listagem → detalhe → revelar gabarito em viewport mobile (`max-w-4xl`).
- Botão "Ver prova" após ingest real concluído.
- CTAs "Em breve" legíveis e claramente desabilitados.

## Verificação

```text
2026-06-19 — SPEC-0008 fechada (listagem + detalhe hub)

npm run typecheck                 # exit 0
npm test -- --run src/db/queries/exams src/functions/exams/get-exam src/functions/exams/list-exams
  → 3 files, 9 tests passed
npm test -- --run src/features/exams
  → 5 files, 17 tests passed
npm test -- --run src/features/background-processes/pages/job-monitor-page
  → 1 file, 4 tests passed
npm run docs-check                # exit 0

routeTree.gen.ts inclui /exams/$examId (regenerado).
Sem conflitos de merge, imports quebrados ou duplicatas de tipo problemáticas.
```
