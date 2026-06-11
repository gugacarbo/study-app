# Routes

**Last updated:** 2026-06-11

TanStack Router file-based. Árvore gerada em `src/routeTree.gen.ts` — não editar.

## Route Table

| File                           | Path                   | Tipo         | Notas                                       |
| ------------------------------ | ---------------------- | ------------ | ------------------------------------------- |
| `__root.tsx`                   | layout                 | Shell        | nav, providers, theme — ver `__root/-*.tsx` |
| `index.tsx`                    | `/`                    | Page         | dashboard                                   |
| `exams.tsx`                    | `/exams`               | Layout       | `<Tabs>` + `<Outlet>`                       |
| `exams.index.tsx`              | `/exams/`              | Page         | lista detalhada                             |
| `exams.$id.tsx`                | `/exams/$id`           | Page         | detalhe do exame                            |
| `exams.stats.tsx`              | `/exams/stats`         | Page         | estatísticas                                |
| `exams.explanations/index.tsx` | `/exams/explanations`  | Page         | pipeline de explicações                     |
| `exams.upload/index.tsx`       | `/exams/upload`        | Page         | upload + job queue UI                       |
| `quiz.$id.tsx`                 | `/quiz/$id`            | Page         | quiz player                                 |
| `admin.config.tsx`             | `/admin/config`        | Page         | AI provider config (admin)                  |
| `config.tsx`                   | `/config`              | Redirect     | → `/admin/config`                           |
| `admin.tsx`                    | `/admin`               | Layout       | `AdminLayout` + shadcn Sidebar + `<Outlet>` |
| `admin.index.tsx`              | `/admin/`              | Redirect     | → `/admin/llm-logs`                         |
| `admin.llm-logs.tsx`           | `/admin/llm-logs`      | Page         | LLM call logs (D1 via server functions)     |
| `admin.process-logs.tsx`       | `/admin/process-logs`  | Page         | ingest background process logs (client)     |
| `chat.tsx`                     | `/chat`                | Page         | chat multi-conversa                         |
| `memory.tsx`                   | `/memory`              | Page         | memória R2+D1                               |
| `about.tsx`                    | `/about`               | Page         | —                                           |
| `api/chat/index.ts`            | `/api/chat`            | API POST     | streaming chat                              |
| `api/ingest/index.ts`          | `/api/ingest`          | API POST stream | pipeline ingestão (UI Message Stream)    |
| `api/test-connection.ts`       | `/api/test-connection` | API POST stream | teste de provider (UI Message Stream)  |

## Colocated modules (`-prefix`)

Lógica pesada fica ao lado da rota, não importada pelo client:

- `api/ingest/-pipeline.ts`, `-extraction-pass.ts`, `-review-stage.ts`, `-sse-emitter.ts`, …
- `exams.upload/-job-view-model.ts`, `-use-upload.ts`, `-output-processors.ts`, …
- `api/chat/-handlers.ts`, `-streaming.ts`, `-tools.ts`

## Convenções

- Páginas delegam para `src/features/` — rotas ~10 linhas quando possível
- API routes: `createFileRoute` + `server.handlers`
- Data: `useSuspenseQuery` + server functions — não route loaders
- Sem auth / guards — app single-user
- Job streams: UI Message Stream via `src/features/ai/core/ui-message-job-stream.ts`

## Notable

- `exams.upload/` substitui rota flat `upload.tsx`
- `api/chat` e `api/ingest` são diretórios com `index.ts`, não arquivos únicos
