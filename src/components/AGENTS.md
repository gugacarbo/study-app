# Components

**Last updated:** 2026-05-29 — extracted hooks/utils, shadcn compliance, all ≤150 lines

React components in TanStack Start SPA. Organized into feature folders under `src/components/`.

## Structure

Components are grouped into subdirectories by feature domain, plus standalone files and `ui/` shadcn primitives.

## Inventory

| Folder / File           | Route                | Entry Point                | Purpose                                                                                                                          |
| ----------------------- | -------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `chat/`                 | `/chat`              | `chat.tsx`                 | AI chat assistant with sidebar, message bubbles, inline title editing. Subdirs: `message/` (7 subcomponents), `hooks/` (3 hooks) |
| `config-form/`          | `/config`            | `config-form.tsx`          | AI provider/model/URL config + test connection dialog                                                                            |
| `exam-detail/`          | `/exams/$id`         | `exam-detail.tsx`          | Exam detail with stats cards, files, topics, questions accordion, inline edit, batch explanation generation                      |
| `exams-view/`           | `/exams`             | `exams-view.tsx`           | Exam list with search, delete (inline confirm), upload dialog                                                                    |
| `memory-visualization/` | `/memory`            | `memory-visualization.tsx` | Memory dashboard: summary cards, topic performance, session history table, session detail sheet                                  |
| `quiz/`                 | `/quiz/$id`          | `quiz.tsx`                 | Quiz player: question display, answer options, results, keyboard hotkeys                                                         |
| `dashboard.tsx`         | `/`                  | standalone                 | Exam list + quick stats cards                                                                                                    |
| `stats-table.tsx`       | `/exams/stats`       | standalone                 | Accuracy stats by topic (plain HTML table)                                                                                       |
| `theme-provider.tsx`    | global (root layout) | standalone                 | Theme context (shadcn) with localStorage + system preference                                                                     |
| `theme-toggle.tsx`      | global (nav)         | standalone                 | Light/dark mode toggle button                                                                                                    |
| `ui/markdown.tsx`       | global (shared)      | ui component               | Markdown → React via `react-markdown` + `remark-gfm`                                                                             |
| `ui/*`                  | global               | shadcn primitives          | `badge`, `button`, `card`, `dialog`, `input`, `progress`, `select`, `sheet`, `table`, `tabs`, `textarea`, etc.                   |

## State Conventions
- **Ephemeral state** → TanStack Store (`quizStore`, `chatStore`, `conversationsStore`)
- **Server data** → TanStack Query with `useSuspenseQuery` + server functions
- **Form state** → `react-hook-form` + `@hookform/resolvers` (ConfigForm) or local `useState`
- **No component tests**

## Patterns
- All components are named exports
- Feature folders: parent component + subcomponents co-located. Use subdirectories (`message/`, `hooks/`) when a feature has 5+ related files
- Max ~150 lines per file — split at logical boundaries
- **shadcn/ui** primitives used for all UI elements (Button, Card, Input, Badge, Progress, etc.)
- **Markdown rendering** via `MarkdownRenderer` (`ui/markdown.tsx`) — used across exam-detail, quiz, and memory components
- **SSE streaming** utilities in `src/lib/sse-stream.ts` — shared by upload form and `config-form`
- Inline hover styles (onMouseEnter/onMouseLeave) prohibited — use shadcn Button variants instead
