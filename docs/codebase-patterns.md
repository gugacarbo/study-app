# Code Patterns — Study App

> This file documents the coding conventions for this project. Always follow
> these patterns when writing or reviewing code.

## Naming Conventions

| Element                | Pattern                     | Example              |
| ---------------------- | --------------------------- | -------------------- |
| Components             | PascalCase                  | `ExamDetail.tsx`     |
| Hooks                  | camelCase with `use` prefix | `useTheme.ts`        |
| Utilities              | camelCase                   | `formatDate`         |
| Server functions       | camelCase                   | `getExamDetail`      |
| DB queries             | camelCase                   | `db.getExams()`      |
| Types/Interfaces       | PascalCase                  | `ExamIngestResponse` |
| Constants              | UPPER_SNAKE_CASE            | `MAX_RETRY_COUNT`    |
| Files (components)     | PascalCase.tsx              | `Dashboard.tsx`      |
| Files (non-components) | kebab-case.ts               | `file-service.ts`    |
| Directories            | kebab-case                  | `server-functions/`  |

## Import Patterns

```typescript
// 1. External packages
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// 2. Internal aliases (@/)
import { getDB } from "@/server-functions/db";
import { cn } from "@/lib/utils";

// 3. Relative imports
import { ExamHeader } from "./exam-header";
```

- Use `@/` alias for cross-directory imports (not `#/*`)
- Use relative imports (`./`) for sibling files within the same directory
- `#/*` alias exists in `package.json` imports but is only used by `chat.tsx` for `#/components/chat-sidebar` — avoid for new code

## Export Patterns

- Default exports for page components and route files
- Named exports for utilities, hooks, and shared components
- Re-export via `index.ts` only when a directory has many public exports

## Error Handling

- Server functions: throw with descriptive message
- Client: use try/catch with user-friendly error display
- Never catch and swallow errors silently
- Always log unexpected errors

## File Organization

| Type              | Location                |
| ----------------- | ----------------------- |
| Routes            | `src/routes/`           |
| Components        | `src/components/`       |
| Server functions  | `src/server-functions/` |
| DB schema/queries | `src/db/`               |
| Shared utilities  | `src/lib/`              |
| Stores            | `src/stores/`           |
| Types             | `src/types/`            |
| Hooks             | `src/hooks/`            |
| Feature modules   | `src/features/`          |
| AI integration    | `src/features/ai/`      |

### Feature Module Structure

- `src/features/ai/` — AI feature module (agents, core, providers, components, hooks, stores)
  - `agents/` — Domain-specific AI agents (chat, ingest, explanations, quiz) with tools + prompts
  - `core/` — Core generation functions (generate, chat-stream)
  - `adapters/` — Provider adapter factory
  - `providers/` — Web search/content provider interfaces + implementations

## Testing Patterns

- Test files mirror source: `src/server-functions/quiz.ts` → `tests/server-functions/quiz.test.ts`
- Use `vitest` + `jsdom` for unit tests
- Mock external dependencies at the module level
- Test mocks must support `stmt.bind(...).raw()` for Drizzle D1 compatibility

## Anti-Patterns (Do Not)

- ❌ Don't use `any` — use `unknown` + type guards
- ❌ Don't import from `#/*` (unused alias, except `chat.tsx` legacy usage)
- ❌ Don't use ESLint/Prettier — use Biome v2
- ❌ Don't store large files in D1 (1MB row limit)
- ❌ Don't use static imports of `cloudflare:workers` in non-Workers contexts — use dynamic `import()` with `/* @vite-ignore */`
- ❌ Don't use `@tanstack/react-form` — use `react-hook-form` + `@hookform/resolvers`
- ❌ Don't use array `index` as React `key` — prefer `id` or another unique field from the object; for unavoidable cases (e.g. skeletons, repeated parts without ids), use `// biome-ignore lint/suspicious/noArrayIndexKey: known use`

## Project-Specific Rules

- Server functions use `createServerFn` with `data` parameter pattern
- AI calls are server-side only (never in browser)
- D1 via Drizzle ORM (not raw SQL for CRUD operations)
- Quiz state persisted to localStorage — keyed by exam/topic
- Config form uses `react-hook-form` + Zod adapter (not TanStack Form)
- Markdown rendering via `react-markdown` + `remark-gfm` with custom component overrides
- Multi-conversation chat with `conversationsStore` (TanStack Store + localStorage persistence)
- Streaming ingest via SSE (`chunk` and `token` events from `/api/ingest`)
- Full-width layout: children opt in via `data-fullwidth` attribute, root layout uses `has-[[data-fullwidth]]:max-w-full`
- `getDB()` uses dynamic `import("cloudflare:workers")` with `/* @vite-ignore */` — never static import

## Styling Conventions

- Tailwind CSS v4 (not v3)
- shadcn/ui components in `src/components/ui/`
- Use `cn()` utility from `@/lib/utils` for conditional class merging
- Dark mode via `theme-provider.tsx` and `theme-toggle.tsx`
- Full-width opt-in: add `data-fullwidth` attribute to route containers
