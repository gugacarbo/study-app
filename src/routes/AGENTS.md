# Routes

TanStack Router file-based routing. 12 entries in `src/routes/`.

## Route Table

| File | Path | Type | Data Source |
|---|---|---|---|
| `__root.tsx` | (root layout) | Layout | QueryClientProvider, theme, devtools, `<Scripts>` |
| `index.tsx` | `/` | Page | `getExams` via TanStack Query |
| `upload.tsx` | `/upload` | Page | — |
| `exams.tsx` | `/exams` | Page | `getExamsDetailed` via TanStack Query |
| `exams.$id.tsx` | `/exams/$id` | Page (params) | `getExamDetail` via TanStack Query |
| `quiz.$id.tsx` | `/quiz/$id` | Page (params) | `generateQuiz` via server fn, `quizStore` |
| `stats.tsx` | `/stats` | Page | `getStats` via TanStack Query |
| `config.tsx` | `/config` | Page | `getConfig`/`setConfig` via server fns |
| `chat.tsx` | `/chat` | Page | Chat API stream |
| `about.tsx` | `/about` | Page | — |
| `obsidian.tsx` | `/obsidian` | Page | `getObsidianStatus` via server fn |
| `api.chat.ts` | `/api/chat` | **API** (POST) | Server-side handler via `server.handlers` |

## Conventions
- **File naming:** TanStack Start file conventions — `__root.tsx` for layout, `$param` for dynamic params, `.` for path nesting (`quiz.$id.tsx` → `/quiz/$id`)
- **API routes:** Use `server.handlers` on `createFileRoute` — only `api.chat.ts` does this
- **Data loading:** Route components call server functions via TanStack Query's `useSuspenseQuery` (not route loaders)
- **No route guards/layouts** — single-user app, no auth

## Notable
- `__root.tsx` is the shell — wraps `<Outlet>` with nav, query client, theme
- `api.chat.ts` is the sole API endpoint (lives alongside page routes)
