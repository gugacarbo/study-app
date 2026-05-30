# Code Patterns — {Project Name}

> This file documents the coding conventions for this project. Always follow
> these patterns when writing or reviewing code.

## Naming Conventions

| Element                | Pattern                     | Example              |
| ---------------------- | --------------------------- | -------------------- |
| Components             | PascalCase                  | `ExamDetail.tsx`     |
| Hooks                  | camelCase with `use` prefix | `useTheme.ts`        |
| Utilities              | camelCase                   | `formatDate.ts`      |
| Server functions       | camelCase                   | `getExamDetail`      |
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

## Testing Patterns

- Test files mirror source: `src/server-functions/quiz.ts` → `tests/server-functions/quiz.test.ts`
- Use `vitest` + `jsdom` for unit tests
- Mock external dependencies at the module level

## Anti-Patterns (Do Not)

- ❌ Don't use `any` — use `unknown` + type guards
- ❌ Don't import from `#/*` (unused alias)
- ❌ Don't use ESLint/Prettier — use Biome v2
- ❌ Don't store large files in D1 (1MB row limit)

## Project-Specific Rules

- Server functions use `createServerFn` with `data` parameter pattern
- AI calls are server-side only (never in browser)
- D1 via Drizzle ORM (not raw SQL for CRUD operations)
- Quiz state persisted to localStorage
