# Routes

**Last updated:** 2026-05-28

TanStack Router file-based routing. Entries in `src/routes/`.

## Route Table

| File | Path | Type | Data Source |
|---|---|---|---|
| `__root.tsx` | (root layout) | Layout | QueryClientProvider, theme, devtools, `<Scripts>` |
| `index.tsx` | `/` | Page | `getExams` via TanStack Query |
| `upload.tsx` | `/upload` | Page | — |
| `exams.tsx` | `/exams` | Layout | `<Outlet>` renders child routes |
| `exams.index.tsx` | `/exams/` | Page | `getExamsDetailed` via TanStack Query |
| `exams.$id.tsx` | `/exams/$id` | Page (params) | `getExamDetail` via TanStack Query |
| `quiz.$id.tsx` | `/quiz/$id` | Page (params) | `generateQuiz` via server fn, `quizStore` |
| `exams.stats.tsx` | `/exams/stats` | Page | `getStats` via TanStack Query |
| `config.tsx` | `/config` | Page | `getConfig`/`setConfig` via server fns |
| `chat.tsx` | `/chat` | Page | Chat API stream |
| `about.tsx` | `/about` | Page | — |
| `memory.tsx` | `/memory` | Page | Memory visualization dashboard (uses MemoryVisualization) |
| `memory-viz.tsx` | `/memory-viz` | Page | Memory visualization dashboard |
| `api/chat.ts` | `/api/chat` | **API** (POST) | Server-side handler via `server.handlers` |
| `api/ingest.ts` | `/api/ingest` | **API** (POST, SSE) | Server-side handler via `server.handlers` |
| `api/test-connection.ts` | `/api/test-connection` | **API** (POST, SSE) | Server-side handler via `server.handlers` |

## Conventions
- **File naming:** TanStack Start file conventions — `__root.tsx` for layout, `$param` for dynamic params, `.` for path nesting (`quiz.$id.tsx` → `/quiz/$id`)
- **API routes:** Use `server.handlers` on `createFileRoute` — `api/chat.ts`, `api/ingest.ts`, and `api/test-connection.ts` do this
- **Data loading:** Route components call server functions via TanStack Query's `useSuspenseQuery` (not route loaders)
- **No route guards/layouts** — single-user app, no auth

## Notable
- `__root.tsx` is the shell — wraps `<Outlet>` with nav, query client, theme
- `exams.tsx` is a layout route with route-driven `<Tabs>` + `<Outlet>` — child routes `exams.index.tsx`, `exams.stats.tsx`, and `exams.$id.tsx` render inside it
- API routes live in `src/routes/api/` directory (chat, ingest, test-connection)
- `api/test-connection.ts` and `api/ingest.ts` use SSE (text/event-stream) for streaming
