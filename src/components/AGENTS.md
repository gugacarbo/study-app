# Components

React components in TanStack Start SPA. 11 files, each self-contained.

## Inventory

| Component | Route | State Source | Purpose |
|---|---|---|---|
| `Dashboard.tsx` | `/` | TanStack Query (`getExams`) | Exam list + quick stats cards |
| `ExamDetail.tsx` | `/exams/$id` | TanStack Query (`getExamDetail`) | Exam detail with stats, files, questions |
| `ExamsView.tsx` | `/exams` | TanStack Query (`getExamsDetailed`) | Exam list with search and delete |
| `UploadForm.tsx` | `/upload` | Local state | PDF file picker + text paste area |
| `Quiz.tsx` | `/quiz/$id` | TanStack Store (`quizStore`) | Question display, timer, answer submission, results |
| `StatsTable.tsx` | `/stats` | TanStack Query (`getStats`) | Plain HTML table — no TanStack Table yet |
| `ConfigForm.tsx` | `/config` | TanStack Query (`getConfig`) | AI provider/model/URL config form |
| `ThemeToggle.tsx` | global (nav) | Local state + class toggle | Light/dark mode switch |
| `Chat.tsx` | `/chat` | Local state + fetch | AI chat assistant |
| `ObsidianConfigForm.tsx` | `/obsidian` | Local state | Obsidian connection config |
| `ObsidianPanel.tsx` | `/obsidian` | TanStack Query | Vault management UI |

## State Conventions
- **Ephemeral quiz state** → `src/stores/quizStore.ts` (TanStack Store)
- **Server data** → TanStack Query with `useSuspenseQuery` + server functions
- **Form state** → Local `useState` (no TanStack Form used yet)
- **No component tests exist** — `@testing-library/react` is installed but unused

## Patterns
- All components are default exports
- No shared component library — each is standalone
- Obsidian components prefixed `Obsidian*` for discoverability
