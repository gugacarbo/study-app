# Components

**Last updated:** 2026-05-28

React components in TanStack Start SPA. 14 files, each self-contained.

## Inventory

| Component | Route | State Source | Purpose |
|---|---|---|---|
| `Dashboard.tsx` | `/` | TanStack Query (`getExams`) | Exam list + quick stats cards |
| `ExamDetail.tsx` | `/exams/$id` | TanStack Query (`getExamDetail`) | Exam detail with stats, files, questions |
| `ExamsView.tsx` | `/exams` | TanStack Query (`getExamsDetailed`) | Exam list with search and delete |
| `UploadForm.tsx` | `/upload` | Local state | PDF file picker + text paste area |
| `Quiz.tsx` | `/quiz/$id` | TanStack Store (`quizStore`) | Question display, timer, answer submission, results |
| `StatsTable.tsx` | `/exams/stats` | TanStack Query (`getStats`) | Plain HTML table — no TanStack Table yet |
| `ConfigForm.tsx` | `/config` | TanStack Query (`getConfig`) | AI provider/model/URL config form |
| `ThemeToggle.tsx` | global (nav) | `useTheme` hook | Light/dark mode toggle button |
| `theme-provider.tsx` | global (root layout) | Context (useState + localStorage) | Theme context provider (shadcn) |
| `Chat.tsx` | `/chat` | TanStack Store (`chatStore`) | AI chat assistant |
| `MemoryPanel.tsx` | `/memory` | TanStack Query (`getMemoryOverview`) | Memory overview and search |
| `MemoryVisualization.tsx` | `/memory` | TanStack Query (`getMemoryOverview`) | Memory stats dashboard with topic charts |
| `ObsidianConfigForm.tsx` | `/obsidian` | Local state | Obsidian connection config |
| `ObsidianPanel.tsx` | `/obsidian` | TanStack Query | Vault management UI |

> **Note:** `ui/tabs.tsx` and `ui/sheet.tsx` were added as shadcn/ui primitives. `ThemeToggle.tsx` was refactored to use the `useTheme` hook from `theme-provider.tsx`. `Chat.tsx` was refactored from local state to TanStack Store (`chatStore`).

## State Conventions
- **Ephemeral state** → `src/stores/quizStore.ts` and `src/stores/chatStore.ts` (TanStack Store)
- **Server data** → TanStack Query with `useSuspenseQuery` + server functions
- **Form state** → `react-hook-form` + `@hookform/resolvers` (ConfigForm) or local `useState` (other forms)
- **No component tests exist** — `@testing-library/react` is installed but unused

## Patterns
- All components are default exports
- No shared component library — each is standalone
- Obsidian components prefixed `Obsidian*` for discoverability
