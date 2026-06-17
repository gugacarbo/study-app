# Convenções — Study App

Estado atual. Imperativo. Para decisões datadas → `docs/adr/`.

## Stack

TanStack Start + Router + Query · React 19 · Cloudflare Workers · D1 + Drizzle · R2 · Biome v2 · Vitest · Tailwind v4 · shadcn/ui · Better Auth · Vercel AI SDK · @assistant-ui/react

## Layout

| Tipo | Local |
|------|--------|
| Rotas (finas) | `src/routes/` |
| Admin (`/admin/*`) | `src/routes/admin.*` |
| Domínio (UI + store + lógica) | `src/features/{domain}/` |
| Server functions | `src/functions/` |
| Schema + queries | `src/db/` (`queries/` modular por domínio) |
| Infra compartilhada | `src/lib/` |
| Hooks compartilhados | `src/hooks/` |
| Hooks de domínio | `src/features/{domain}/hooks/` |
| UI primitiva (shadcn) | `src/components/ui/` |
| Composites cross-feature | `src/components/` |
| Streaming / agents IA | `src/features/ai/` (rotas API delegam) |

### `src/functions/`

```
functions/
  db.ts, storage.ts
  auth/
  exams/, quiz/, memory/, ai/, chat/, admin/
```

## Imports

1. Pacotes externos
2. `@/` para cross-directory (`tsconfig` + shadcn)
3. `./` para siblings

Não usar `#/*`. Testes usam `@/` como o app.

## Naming

| Elemento | Padrão |
|----------|--------|
| Componentes / arquivos UI | PascalCase `.tsx` |
| Hooks, utils, functions | camelCase |
| Diretórios | kebab-case |
| Constantes | UPPER_SNAKE_CASE |
| PKs de domínio | UUID `text` (SPEC-0001) |

## Server functions (`src/functions/`)

- `createServerFn` + Zod via `inputValidator` (`src/lib/validation.ts`)
- Toda chamada de IA no servidor — nunca no browser
- `getSession` / `requireSession` em `functions/auth/` — toda function de domínio exige sessão
- `/admin/*`: `requireAdminSession` — permissão `admin:access` via `src/lib/rbac.ts`; falha → **404** (ADR-0010)
- D1 via `getDB()` em `functions/db.ts` — não importar de client

## Data loading

Rotas usam `useSuspenseQuery` + functions — não route loaders (exceto `beforeLoad` para auth).

## Forms

`react-hook-form` + `@hookform/resolvers` + Zod. Não usar `@tanstack/react-form`.

## Shell e devtools

Layout global em redesign (não copiar shell do `.old_app/`). TanStack Devtools + Assistant DevTools no root **apenas em `development`**.

## Testes

Colocados ao lado do código: `foo.test.ts`, `bar.spec.tsx`. Ver `docs/context/TESTS.md`.

## Erros

Server: throw com mensagem descritiva. Client: try/catch + UI amigável. Recurso de outro usuário → **404**. Nunca engolir erro.

## Anti-patterns

- `any` → `unknown` + type guards
- Blobs grandes em D1 (limite ~1MB/row) → R2
- `index` como React `key` (usar `id`; `biome-ignore` só se inevitável)
- Editar `src/routeTree.gen.ts`
- Misturar agents de domínios diferentes
- Hover inline (`onMouseEnter`) → variantes shadcn Button
- Importar de `.old_app/` no código novo
- Classe `DBQueries` monolítica — usar módulos em `db/queries/`
- Stores de job em `src/stores/` — usar `features/background-processes/` (sync server-side, ADR-0006)
- Tratar fechar aba como cancel de job LLM — usar `POST /api/jobs/:id/cancel`
- LLM e R2: sempre via `lib/llm-logging.ts` e `lib/r2-audit.ts` — logs nunca deletados (ADR-0007)
- API keys em D1: sempre `encryptSecret` antes de persistir (ADR-0008)
- Upload ingest v1: só `.txt`/`.md` — rejeitar `.pdf` (ADR-0002)
